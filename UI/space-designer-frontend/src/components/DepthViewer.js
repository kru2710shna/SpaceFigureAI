import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "../styles/DepthViewer.css";
import { useNavigate } from "react-router-dom";

export default function DepthViewer() {
  const mountRef = useRef(null);
  const navigate = useNavigate();

  const [uploadId, setUploadId] = useState("");
  const [depthUrl, setDepthUrl] = useState("");
  const [layout, setLayout] = useState([]);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ====================================================
  // 🔹 Initialization Pipeline
  // ====================================================
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError("");

        console.log("🧩 Initializing DepthViewer pipeline...");

        // 1️⃣ Fetch latest detection files
        const resp = await fetch("http://localhost:5050/test-outputs");
        const uploadList = await resp.json();

        if (!uploadList.files?.length)
          throw new Error("No detection files found in /test-outputs.");

        // Safely find valid detection JSON
        const latestJson = uploadList.files.find(
          (f) =>
            typeof f === "string" &&
            f.endsWith("_detections_blueprint.json") &&
            /^https?:\/\//i.test(f)
        );

        if (!latestJson) throw new Error("No valid detection JSON found.");

        // Derive annotated image safely
        const latestImg = latestJson.replace(
          "_detections_blueprint.json",
          "_detected_blueprint.jpg"
        );

        if (!/^https?:\/\//i.test(latestImg))
          throw new Error(`Invalid image URL: ${latestImg}`);

        console.log("✅ Using JSON:", latestJson);
        console.log("✅ Using annotated image:", latestImg);

        const id = latestImg.split("-")[0];
        setUploadId(id);

        // 2️⃣ Generate depth map
        const depthRes = await fetch("http://localhost:5050/depth/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: latestImg }),
        });

        if (!depthRes.ok)
          throw new Error(`Depth API failed with ${depthRes.status}`);

        const depth = await depthRes.json();
        console.log("🧠 Depth API Response:", depth);

        if (!depth || !depth.depth_url)
          throw new Error("Depth generation failed or invalid format.");
        if (!/^https?:\/\//i.test(depth.depth_url))
          throw new Error("Depth URL invalid.");

        setDepthUrl(depth.depth_url);

        // 3️⃣ Math computation
        const mathRes = await fetch("http://localhost:5050/math/run");
        if (!mathRes.ok)
          throw new Error(`Math route failed with ${mathRes.status}`);

        const math = await mathRes.json();
        console.log("📐 Math output:", math);

        // 4️⃣ Groq reasoning (object layout)
        const groqRes = await fetch("http://localhost:5050/groq/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upload_id: id,
            objects: math.objects,
            scale_ratio_m: math.scale_ratio_m,
            depth_hint: depth.depth_values || [],
          }),
        });

        if (!groqRes.ok)
          throw new Error(`Groq reasoning failed with ${groqRes.status}`);

        const groq = await groqRes.json();
        console.log("🧩 Groq reasoning output:", groq);

        if (!Array.isArray(groq.result))
          throw new Error("Invalid Groq reasoning structure.");
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

  // ====================================================
  // 🎨 3D Scene Renderer
  // ====================================================
  useEffect(() => {
    if (!depthUrl || error) return;

    let isMounted = true;
    const mount = mountRef.current;

    if (!mount) {
      console.warn("⚠️ mountRef is null — skipping render init");
      return;
    }

    console.log("🎨 Building 3D scene...");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d0d);

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

    // Depth Surface
    const texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = "anonymous";

    const tex = texLoader.load(
      depthUrl,
      () => console.log("🧱 Depth texture loaded successfully"),
      undefined,
      (err) => console.error("❌ Failed to load texture:", err)
    );

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

    // Add reconstructed objects
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

    // Animation Loop
    const animate = () => {
      if (!isMounted) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handling
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
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, [depthUrl, layout, scale, error]);

  // ====================================================
  // 🧭 UI Rendering
  // ====================================================
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
