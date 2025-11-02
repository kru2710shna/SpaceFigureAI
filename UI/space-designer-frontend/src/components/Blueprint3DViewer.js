import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useNavigate } from "react-router-dom";

export default function Blueprint3DViewer() {
  const mountRef = useRef(null);
  const navigate = useNavigate();
  const [err, setErr] = useState("");

  useEffect(() => {
    let renderer, scene, camera, controls;
    let needsCleanup = false;

    (async () => {
      try {
        // 1) Get px->meter scale from Math Agent
        const mathRes = await fetch("http://localhost:5050/math/run");
        if (!mathRes.ok) throw new Error("Math Agent not available");
        const math = await mathRes.json();

        const pxToM =
          typeof math.scale_ratio_m === "number" && math.scale_ratio_m > 0
            ? math.scale_ratio_m
            : null;
        if (!pxToM) throw new Error("Missing px->m scale from Math Agent");

        // 2) Find detections file (prefer the one Math used)
        let detectionsFile = math.latest_file;
        if (!detectionsFile) {
          // Fallback: scan outputs for the newest *_detections_blueprint.json
          const t = await fetch("http://localhost:5050/test-outputs");
          const td = await t.json();
          detectionsFile = (td.files || [])
            .filter((f) => f.endsWith("_detections_blueprint.json"))
            .sort((a, b) => b.localeCompare(a))[0];
        }
        if (!detectionsFile) throw new Error("No detections JSON found");

        const detectionsURL = `http://localhost:5050/agents/outputs/${encodeURIComponent(
          detectionsFile
        )}`;
        const detRes = await fetch(detectionsURL);
        if (!detRes.ok) throw new Error("Failed to load detections JSON");
        const detections = await detRes.json();
        if (!Array.isArray(detections) || detections.length === 0) {
          throw new Error("Detections JSON is empty/invalid");
        }

        // 3) Init three.js
        const mount = mountRef.current;
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e1e1e);

        camera = new THREE.PerspectiveCamera(
          60,
          window.innerWidth / window.innerHeight,
          0.1,
          5000
        );
        camera.position.set(0, 30, 60);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        mount.appendChild(renderer.domElement);
        needsCleanup = true;

        // Lights
        scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.8));
        const dir = new THREE.DirectionalLight(0xffffff, 1.5);
        dir.position.set(100, 200, 100);
        dir.castShadow = true;
        scene.add(dir);
        scene.add(new THREE.AmbientLight(0xffffff, 0.2));

        // Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2;

        // Floor (meters)
        const floorSize = 200; // 200 m square just as backdrop
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x202020 });
        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(floorSize, floorSize),
          floorMat
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Style tables
        const COLORS = {
          Wall: 0xffffff,
          Door: 0xa0522d,
          Window: 0x87ceeb,
          Column: 0xffd700,
          Railing: 0x999999,
          "Stair Case": 0x8b4513,
        };

        // Thickness (meters) for extrusions in the "thin" axis
        const THICKNESS = {
          Wall: 0.15,
          Door: 0.06,
          Window: 0.08,
          Column: 0.30, // cylinder radius handled below
          Railing: 0.05,
          "Stair Case": 0.25,
        };

        // Keep track of extents to frame the scene
        const aabb = new THREE.Box3();

        // We’ll consider image center ~ (0,0) on the plane.
        // Use bbox size in px → meters for footprint (X/Z) and height (Y).
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

        // Compute image center if present in detections metadata; else assume (W,H) ~ (640,480)
        const fallbackW = 640;
        const fallbackH = 480;
        let imgW = fallbackW, imgH = fallbackH;
        if (detections[0]?.image_size) {
          const s = detections[0].image_size; // e.g., [w, h] or {width, height}
          if (Array.isArray(s) && s.length >= 2) { imgW = s[0]; imgH = s[1]; }
          if (s?.width && s?.height) { imgW = s.width; imgH = s.height; }
        }
        const cxPx = imgW / 2, cyPx = imgH / 2;

        for (const obj of detections) {
          const label = obj.label;
          const [x1, y1, x2, y2] = obj.bbox_xyxy;
          const wPx = Math.abs(x2 - x1);
          const hPx = Math.abs(y2 - y1);

          // meters
          const wM = wPx * pxToM;
          const hM = hPx * pxToM; // vertical size if treated as "height"
          const thin = THICKNESS[label] ?? 0.1;

          // Place on XZ plane; use bbox center relative to image center
          const cx = ((x1 + x2) / 2 - cxPx) * pxToM;
          const cz = ((y1 + y2) / 2 - cyPx) * pxToM;

          // Geometry choices:
          // - For 'Column': cylinder with radius from min dimension, height ~ hM
          // - For others: box with footprint (wM x thin) and height hM (extrude Y).
          let mesh;
          if (label === "Column") {
            const radius = Math.max(0.15, Math.min(wM, hM) * 0.25); // clamp to reasonable size
            const geo = new THREE.CylinderGeometry(radius, radius, Math.max(hM, 2), 16);
            const mat = new THREE.MeshStandardMaterial({
              color: COLORS[label] || 0xffffff,
              metalness: 0.1,
              roughness: 0.8,
            });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(cx, Math.max(hM, 2) / 2, cz);
          } else {
            // Decide which bbox side is along X or Z. Heuristic: longer side is "length" in X
            const lengthX = Math.max(wM, hM);
            const depthZ  = Math.min(wM, hM);

            const geo = new THREE.BoxGeometry(lengthX, Math.max(hM, 2), Math.max(thin, depthZ*0.2));
            const mat = new THREE.MeshStandardMaterial({
              color: COLORS[label] || 0xffffff,
              opacity: label === "Window" ? 0.5 : 1.0,
              transparent: label === "Window",
              metalness: 0.05,
              roughness: 0.75,
            });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(cx, Math.max(hM, 2) / 2, cz);
          }

          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
          aabb.expandByObject(mesh);

          // Label
          await addLabel(label, new THREE.Vector3(cx - 0.5, (mesh.position.y * 2) + 0.5, cz));
        }

        // Frame the camera around the built content
        const size = new THREE.Vector3();
        aabb.getSize(size);
        const center = new THREE.Vector3();
        aabb.getCenter(center);

        // Place camera so everything fits nicely
        const maxDim = Math.max(size.x, size.z, size.y);
        const dist = maxDim * 1.8;
        camera.position.set(center.x + dist, center.y + dist * 0.6, center.z + dist);
        camera.lookAt(center);

        // Ground helper at center
        const grid = new THREE.GridHelper(Math.ceil(maxDim + 10), 20, 0x666666, 0x333333);
        grid.position.set(center.x, 0.001, center.z);
        scene.add(grid);

        // Render loop
        const animate = () => {
          if (!renderer) return;
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        // Resize
        const onResize = () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", onResize);

        // Cleanup
        return () => {
          window.removeEventListener("resize", onResize);
          if (needsCleanup && mount && renderer?.domElement?.parentNode === mount) {
            mount.removeChild(renderer.domElement);
          }
          renderer?.dispose();
        };
      } catch (e) {
        console.error(e);
        setErr(e.message || "Failed to build 3D scene");
      }
    })();

    return () => {
      // if inner async returned a cleanup, it’s already handled
    };
  }, []);

  if (err) {
    return (
      <div style={{display:"grid",placeItems:"center",height:"100vh",color:"#fff"}}>
        ❌ {err}
        <button
          onClick={() => navigate(-1)}
          style={{marginTop:16, padding:"10px 16px", borderRadius:8, border:"1px solid #ffffff30", background:"#ffffff10", color:"#fff"}}
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div ref={mountRef} style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          background: "#ffffff10",
          color: "#fff",
          border: "1px solid #ffffff30",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold",
          backdropFilter: "blur(5px)",
        }}
      >
        ← Back
      </button>
    </div>
  );
}
