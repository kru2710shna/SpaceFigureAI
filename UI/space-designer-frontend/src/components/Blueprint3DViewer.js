import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import data from "../assets/1762035385048-test_detections_blueprint.json";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";



export default function Blueprint3DViewer() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e1e);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 150, 300);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x404040, 0.8);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(100, 200, 100);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2;

    // Floor plane
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x202020 });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      floorMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Define colors & heights per object type
    const COLORS = {
      Wall: 0xffffff,
      Door: 0xa0522d,
      Window: 0x87ceeb,
      Column: 0xffd700,
      Railing: 0x999999,
      "Stair Case": 0x8b4513,
    };

    const HEIGHTS = {
      Wall: 40,
      Door: 25,
      Window: 20,
      Column: 40,
      Railing: 15,
      "Stair Case": 10,
    };

    // Get canvas scale
    const scaleFactor = 0.6;

    // Add all labeled objects
    data.forEach((obj) => {
      const [x1, y1, x2, y2] = obj.bbox_xyxy;
      const w = (x2 - x1) * scaleFactor;
      const h = (y2 - y1) * scaleFactor;
      const cx = ((x1 + x2) / 2 - 320) * scaleFactor;
      const cy = ((y1 + y2) / 2 - 240) * scaleFactor;

      const geometry =
        obj.label === "Column"
          ? new THREE.CylinderGeometry(w / 3, w / 3, HEIGHTS[obj.label], 16)
          : new THREE.BoxGeometry(w, HEIGHTS[obj.label], h);

      const material = new THREE.MeshStandardMaterial({
        color: COLORS[obj.label] || 0xffffff,
        opacity: obj.label === "Window" ? 0.5 : 1.0,
        transparent: obj.label === "Window",
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(cx, HEIGHTS[obj.label] / 2, cy);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Optional label text above each object
      const loader = new FontLoader();
        loader.load(
        "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json",
        (font) => {
            const textGeo = new TextGeometry(obj.label, {
            font,
            size: 3,
            height: 0.1,
            });
            const textMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const textMesh = new THREE.Mesh(textGeo, textMat);
            textMesh.position.set(cx - w / 2, HEIGHTS[obj.label] + 3, cy);
            scene.add(textMesh);
        }
        );
    });

    // Render Loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
