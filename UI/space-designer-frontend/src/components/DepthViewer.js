import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "../styles/DepthViewer.css";

export default function DepthViewer() {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [depthUrl, setDepthUrl] = useState("");
  const [colorUrl, setColorUrl] = useState("");
  const [useColor, setUseColor] = useState(false);
  const [scale, setScale] = useState(2.0);

  // ---------- Fetch Depth Map from Backend ----------
  useEffect(() => {
    async function fetchDepth() {
      try {
        setError("");
        setLoading(true);

        const res = await fetch("http://localhost:5050/test-outputs");
        const data = await res.json();

        const latest = data.files
          ?.filter((f) => /\.(jpeg|jpg|png)$/i.test(f))
          .sort((a, b) => b.localeCompare(a))[0];

        if (!latest) {
          setError("No uploaded images found for depth rendering.");
          setLoading(false);
          return;
        }

        console.log("🖼️ Latest image:", latest);

        const depthRes = await fetch("http://localhost:5050/depth/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: latest }),
        });

        const depthData = await depthRes.json();
        console.log("🧠 Depth response:", depthData);

        if (!depthData.depth_url) {
          throw new Error("No depth URL returned from backend.");
        }

        setDepthUrl(depthData.depth_url);
        if (depthData.color_url) setColorUrl(depthData.color_url);
      } catch (err) {
        console.error("❌ Depth fetch failed:", err);
        setError(err.message || "Depth generation failed.");
      } finally {
        setLoading(false);
      }
    }

    fetchDepth();
  }, []);

  // ---------- Three.js Renderer ----------
  useEffect(() => {
    if (!depthUrl || error) return;

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    // ✅ Camera
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(4, 5, 6);

    // ✅ Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // ✅ Texture
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(useColor ? colorUrl || depthUrl : depthUrl);

    // ✅ Geometry + Material
    const geometry = new THREE.PlaneGeometry(6, 6, 512, 512);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      displacementMap: texture,
      displacementScale: scale,
      metalness: 0.1,
      roughness: 0.75,
      color: 0xffffff,
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    plane.receiveShadow = true;
    scene.add(plane);

    // ✅ Ground Plane
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshPhongMaterial({
      color: 0x222222,
      shininess: 20,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    // ✅ Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x404040, 1.0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(-5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // ✅ Ambient fill for contrast
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    // ✅ Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(0, 0, 0);

    // ✅ Animate
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ✅ Resize Handling
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // ✅ Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [depthUrl, colorUrl, useColor, scale, error]);

  // ---------- Loading / Error ----------
  if (loading) {
    return (
      <div className="center-screen">
        <span>🌀 Generating Depth Map...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="center-screen error">
        <span>❌ {error}</span>
      </div>
    );
  }

  // ---------- UI ----------
  return (
    <div className="viewer-container">
      <div ref={mountRef} className="viewer-canvas" />

      {colorUrl && (
        <button
          onClick={() => setUseColor(!useColor)}
          className="toggle-btn"
        >
          {useColor ? "🖤 View Grayscale" : "🎨 View Heatmap"}
        </button>
      )}

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
