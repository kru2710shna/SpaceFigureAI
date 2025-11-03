import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "../styles/DepthViewer.css";
import { useNavigate } from "react-router-dom";

export default function DepthViewer() {
  const mountRef = useRef(null);
  const [depthUrl, setDepthUrl] = useState("");
  const [layout, setLayout] = useState([]);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [uploadId, setUploadId] = useState("");

  // 🔹 Fetch latest blueprint JSON + image and initialize rendering pipeline
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError("");

        // 1️⃣ Get latest detection JSON (blueprint)
        const uploadList = await fetch("http://localhost:5050/test-outputs").then((r) =>
          r.json()
        );
        const latestJson = uploadList.files?.find((f) =>
          f.endsWith("_detections_blueprint.json")
        );
        if (!latestJson) throw new Error("No detection JSON found.");

        // Derive corresponding annotated image
        const latestImg = latestJson
          .replace("_detections_blueprint.json", "_detected_blueprint.jpg")
          .trim();
        const id = latestImg.split("-")[0];
        setUploadId(id);

        // 2️⃣ Depth estimation
        const depthRes = await fetch("http://localhost:5050/depth/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: latestImg }),
        });
        const depth = await depthRes.json();
        if (!depth.depth_url) throw new Error("Depth generation failed.");
        setDepthUrl(depth.depth_url);

        // 3️⃣ Math computation
        const mathRes = await fetch("http://localhost:5050/math/run");
        const math = await mathRes.json();

        // 4️⃣ Groq reasoning (layout reconstruction)
        const groqRes = await fetch("http://localhost:5050/groq/groq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upload_id: id,
            objects: math.objects,
            scale_ratio_m: math.scale_ratio_m,
            depth_hint: depth.depth_values || [],
          }),
        });
        const groq = await groqRes.json();
        if (!Array.isArray(groq.result))
          throw new Error("Invalid Groq reasoning output.");

        setLayout(groq.result);
      } catch (err) {
        console.error("❌ Init error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // 🎨 3D Scene Renderer
  useEffect(() => {
    let isMounted = true;
    if (!depthUrl || error) return;

    const mount = mountRef.current;
    if (!mount) {
      console.warn("⚠️ mountRef is null — skipping render init");
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(8, 10, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.2));

    // Depth surface
    const tex = new THREE.TextureLoader().load(depthUrl);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12, 256, 256),
      new THREE.MeshStandardMaterial({
        map: tex,
        displacementMap: tex,
        displacementScale: scale * 0.6,
        roughness: 0.8,
        color: 0xffffff,
      })
    );
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // Object overlays (walls, doors, etc.)
    layout.forEach((o) => {
      const { label, position, size } = o;
      const geo = new THREE.BoxGeometry(size.width, size.height, size.depth);
      const colorMap = {
        Wall: 0xdddddd,
        Door: 0x8b4513,
        Window: 0x87cefa,
        Column: 0xffd700,
        "Stair Case": 0xa9a9a9,
        Railing: 0x999999,
      };
      const mat = new THREE.MeshStandardMaterial({
        color: colorMap[label] || 0x999999,
        opacity: label === "Window" ? 0.6 : 1.0,
        transparent: label === "Window",
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(position.x, position.y, position.z);
      scene.add(mesh);
    });

    const animate = () => {
      if (!isMounted) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      if (mount && renderer) {
        mount.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, [depthUrl, layout, scale, error]);

  // 🧭 UI Rendering
  if (loading) return <div className="center-screen">Building 3D Scene...</div>;
  if (error) return <div className="center-screen error">❌ {error}</div>;

  return (
    <div className="viewer-container">
      <div ref={mountRef} className="viewer-canvas" />
      <button className="back-btn" onClick={() => navigate(-1)}>
        Back
      </button>
      <div className="slider-container">
        <label>Height Scale: {scale.toFixed(1)}</label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.1"
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
