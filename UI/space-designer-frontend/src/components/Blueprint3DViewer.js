import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useNavigate } from "react-router-dom";

export default function Blueprint3DViewer() {
  const mountRef = useRef(null);
  const navigate = useNavigate();
  const [err, setErr] = useState("");

  // 🔧 Helper to guarantee we always get a valid absolute URL
  const sanitizeURL = (url) => {
    if (!url || typeof url !== "string") return "";
    // already absolute
    if (url.startsWith("http://") || url.startsWith("https://")) return url.trim();
    // remove accidental double-encoded prefix
    url = url.replace(/^http.*?(http.*)$/i, "$1");
    // make local absolute
    return `http://localhost:5050/agents/outputs/${url.split("/").pop()}`;
  };

  useEffect(() => {
    let renderer, scene, camera, controls;
    let cleanupFn;

    (async () => {
      try {
        console.log("📏 Fetching from Math Agent...");
        const mathRes = await fetch("http://localhost:5050/math/run");
        if (!mathRes.ok) throw new Error(`Math Agent unavailable (${mathRes.status})`);
        const math = await mathRes.json();

        const pxToM =
          typeof math.scale_ratio_m === "number" && math.scale_ratio_m > 0
            ? math.scale_ratio_m
            : null;
        if (!pxToM) throw new Error("Missing px→meter scale from Math Agent");

        // -------------------------------
        // 2️⃣ Locate detections JSON
        // -------------------------------
        let detectionsFile = math.latest_file;

        if (!detectionsFile) {
          console.log("🧭 Fallback: fetching /test-outputs...");
          const list = await fetch("http://localhost:5050/test-outputs");
          if (!list.ok) throw new Error("Failed to fetch test outputs");
          const data = await list.json();
          detectionsFile = (data.files || [])
            .filter((f) => typeof f === "string" && f.endsWith("_detections_blueprint.json"))
            .sort((a, b) => b.localeCompare(a))[0];
        }

        if (!detectionsFile) throw new Error("No detections JSON found.");

        const detectionsURL = sanitizeURL(detectionsFile);
        console.log("📄 Loading detections:", detectionsURL);

        const detRes = await fetch(detectionsURL);
        if (!detRes.ok) throw new Error(`Failed to load detections (${detRes.status})`);
        const detections = await detRes.json();
        if (!Array.isArray(detections) || detections.length === 0)
          throw new Error("Detections JSON empty or invalid.");

        // -------------------------------
        // 3️⃣ Three.js scene setup
        // -------------------------------
        const mount = mountRef.current;
        if (!mount) throw new Error("Mount reference not available.");

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);

        camera = new THREE.PerspectiveCamera(
          60,
          window.innerWidth / window.innerHeight,
          0.1,
          5000
        );
        camera.position.set(0, 25, 50);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        mount.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2;

        // Lights
        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
        const dir = new THREE.DirectionalLight(0xffffff, 1.2);
        dir.position.set(100, 200, 100);
        dir.castShadow = true;
        scene.add(dir);
        scene.add(new THREE.AmbientLight(0xffffff, 0.25));

        // Floor
        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // -------------------------------
        // 4️⃣ Build objects
        // -------------------------------
        const COLORS = {
          Wall: 0xffffff,
          Door: 0xa0522d,
          Window: 0x87ceeb,
          Column: 0xffd700,
          Railing: 0xaaaaaa,
          "Stair Case": 0x8b4513,
        };

        const THICKNESS = {
          Wall: 0.15,
          Door: 0.06,
          Window: 0.08,
          Column: 0.3,
          Railing: 0.05,
          "Stair Case": 0.25,
        };

        const fontLoader = new FontLoader();
        const addLabel = (text, pos) =>
          new Promise((resolve) => {
            fontLoader.load(
              "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json",
              (font) => {
                const geo = new TextGeometry(text, { font, size: 0.6, height: 0.05 });
                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.copy(pos);
                scene.add(mesh);
                resolve();
              }
            );
          });

        const fallbackW = 640,
          fallbackH = 480;
        let imgW = fallbackW,
          imgH = fallbackH;
        if (detections[0]?.image_size) {
          const s = detections[0].image_size;
          if (Array.isArray(s) && s.length >= 2) {
            imgW = s[0];
            imgH = s[1];
          } else if (s?.width && s?.height) {
            imgW = s.width;
            imgH = s.height;
          }
        }

        const cxPx = imgW / 2,
          cyPx = imgH / 2;
        const aabb = new THREE.Box3();

        for (const obj of detections) {
          const label = obj.label || "Unknown";
          if (!obj.bbox_xyxy) continue;
          const [x1, y1, x2, y2] = obj.bbox_xyxy;
          const wPx = Math.abs(x2 - x1);
          const hPx = Math.abs(y2 - y1);
          const wM = wPx * pxToM;
          const hM = hPx * pxToM;
          const thin = THICKNESS[label] ?? 0.1;
          const cx = ((x1 + x2) / 2 - cxPx) * pxToM;
          const cz = ((y1 + y2) / 2 - cyPx) * pxToM;

          let mesh;
          if (label === "Column") {
            const radius = Math.max(0.15, Math.min(wM, hM) * 0.25);
            const geo = new THREE.CylinderGeometry(radius, radius, Math.max(hM, 2), 16);
            const mat = new THREE.MeshStandardMaterial({
              color: COLORS[label] || 0xffffff,
              roughness: 0.8,
            });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(cx, Math.max(hM, 2) / 2, cz);
          } else {
            const lengthX = Math.max(wM, hM);
            const depthZ = Math.min(wM, hM);
            const geo = new THREE.BoxGeometry(lengthX, Math.max(hM, 2), Math.max(thin, depthZ * 0.2));
            const mat = new THREE.MeshStandardMaterial({
              color: COLORS[label] || 0xffffff,
              opacity: label === "Window" ? 0.5 : 1.0,
              transparent: label === "Window",
            });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(cx, Math.max(hM, 2) / 2, cz);
          }

          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
          aabb.expandByObject(mesh);
          await addLabel(label, new THREE.Vector3(cx - 0.5, mesh.position.y * 1.2, cz));
        }

        // Camera framing
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        aabb.getSize(size);
        aabb.getCenter(center);
        const maxDim = Math.max(size.x, size.z, size.y);
        const dist = maxDim * 1.8;
        camera.position.set(center.x + dist, center.y + dist * 0.6, center.z + dist);
        camera.lookAt(center);

        const grid = new THREE.GridHelper(Math.ceil(maxDim + 10), 20, 0x666666, 0x333333);
        grid.position.set(center.x, 0.001, center.z);
        scene.add(grid);

        const animate = () => {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", onResize);

        cleanupFn = () => {
          window.removeEventListener("resize", onResize);
          if (renderer && mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
          renderer.dispose();
        };
      } catch (e) {
        console.error("❌ Blueprint 3D Viewer Error:", e);
        setErr(e.message || "Failed to build 3D scene.");
      }
    })();

    return () => cleanupFn && cleanupFn();
  }, []);

  if (err) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "red" }}>
        ❌ {err}
        <button
          onClick={() => navigate(-1)}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #ff4444",
            background: "#1a1a1a",
            color: "white",
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
