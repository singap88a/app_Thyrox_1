import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";

import { API_BASE_URL } from "../constants/api";

interface Thyroid3DViewerProps {
  diseaseType?: string;
}
// ////
export default function Thyroid3DViewer({ diseaseType }: Thyroid3DViewerProps) {
  const hasDisease = diseaseType && diseaseType.toLowerCase() !== "normal" && diseaseType.toLowerCase() !== "benign";
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body { margin: 0; padding: 0; background-color: transparent; overflow: hidden; }
        canvas { display: block; width: 100vw; height: 100vh; }
        .disease-label {
          position: absolute;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: white;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-family: sans-serif;
          font-size: 11px;
          pointer-events: none;
          transform: translate(-50%, -100%);
          margin-top: -15px;
          display: none;
        }
        .disease-title { font-weight: 900; color: #f87171; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; font-size: 9px; }
      </style>
    </head>
    <body>
      <div id="label" class="disease-label">
        <div class="disease-title">Functional Status</div>
        <div style="font-size: 14px; font-weight: bold; color: #00d4ff; text-transform: capitalize;">${diseaseType || "Abnormality"}</div>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
      <script>
        const scene = new THREE.Scene();
        // Transparent background matching the container
        
        const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 4);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);
        
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;
        controls.minDistance = 2;
        controls.maxDistance = 8;
        
        // Lighting from web dashboard
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(5, 5, 5);
        scene.add(mainLight);

        const group = new THREE.Group();
        scene.add(group);

        let diseaseMarker = null;
        
        const DISEASE_LOCATION_MAP = {
          1: { x: -0.40, y: -0.5, z: 0.3 },
          2: { x: 0.5, y: 0.2, z: 0.25 },
          3: { x: 0.6, y: 0, z: 0.3 },
          4: { x: 0.5, y: -0.2, z: 0.25 },
          5: { x: -0.5, y: 0.2, z: 0.25 },
          6: { x: -0.6, y: 0, z: 0.3 },
          7: { x: -0.5, y: -0.2, z: 0.25 },
          8: { x: 0, y: 0.15, z: 0.2 },
        };

        const loader = new THREE.GLTFLoader();
        // Load model from backend static files
        loader.load('${API_BASE_URL}/models/thyroid.glb', (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const scale = 2.5 / Math.max(size.x, size.y, size.z);
          model.scale.setScalar(scale);
          model.position.sub(center.multiplyScalar(scale));

          model.traverse(n => { 
            if (n.isMesh) { 
              n.material.transparent = false; 
              n.material.opacity = 1.0; 
            } 
          });
          group.add(model);

          if (${hasDisease}) {
            const geo = new THREE.SphereGeometry(0.08, 32, 32);
            const mat = new THREE.MeshPhongMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 0.5 });
            diseaseMarker = new THREE.Mesh(geo, mat);
            
            // Map disease location from backend if available, or default to Right Lobe Superior
            const pos = DISEASE_LOCATION_MAP[1] || { x: 0.5, y: 0.2, z: 0.25 };
            diseaseMarker.position.set(pos.x, pos.y, pos.z);
            scene.add(diseaseMarker);
          }
        }, undefined, (err) => {
          console.error("Failed to load GLTF", err);
          // Fallback like the web
          const geo = new THREE.TorusKnotGeometry(0.6, 0.2, 100, 16);
          const mat = new THREE.MeshPhongMaterial({ color: 0x4a90d9, transparent: true, opacity: 0.7 });
          group.add(new THREE.Mesh(geo, mat));
        });

        const labelDiv = document.getElementById('label');

        function animate() {
          requestAnimationFrame(animate);
          controls.update();
          
          if (diseaseMarker) {
             diseaseMarker.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.2);
             
             if (${hasDisease}) {
               const vector = diseaseMarker.position.clone();
               // Since marker is directly in scene, we just project it directly
               vector.project(camera);
               const x = (vector.x * .5 + .5) * window.innerWidth;
               const y = (-(vector.y * .5) + .5) * window.innerHeight;
               labelDiv.style.left = x + 'px';
               labelDiv.style.top = y + 'px';
             }
          }
          
          renderer.render(scene, camera);
        }
        
        animate();
      </script>
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 0 }}
          title="3D Thyroid Viewer"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#0d1520",
    borderWidth: 1,
    borderColor: "#1e2d4a",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
