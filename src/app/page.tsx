//C:\projects\threecare\src\app\page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Stats from 'three/examples/jsm/libs/stats.module.js';

interface BufferView {
  target?: number;
  byteLength: number;
}

interface GltfImage {
  bufferView?: number;
}

interface GltfAccessor {
  bufferView?: number;
}

interface GltfChannel {
  sampler?: number;
}

interface GltfAnimation {
  channels?: GltfChannel[];
}

interface JsonData {
  bufferViews?: BufferView[];
  images?: GltfImage[];
  animations?: GltfAnimation[];
  accessors?: GltfAccessor[];
}

interface RenderInfo {
  triangles: number;
  calls: number;
  lines: number;
  points: number;
  drawCalls: number;
}

interface MemoryInfo {
  geometryTotal: number;
  textureTotal: number;
  materialTotal: number;
  vertices: number;
  polygons: number;
  textures: {
    count: number;
    memory: number;
  };
  uvMaps: number;
  normals: number;
  tangents: number;
  indices: number;
  attributes: {
    count: number;
    memory: number;
  };
  materials: {
    count: number;
    memory: number;
  };
  totalMemory: number;
}

interface FileInfo {
  totalSize: number;
  components: {
    geometries: number;
    textures: number;
    animations: number;
    others: number;
  };
}

interface CollapsiblePanelProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const ChevronUpIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className="w-5 h-5 text-gray-600"
  >
    <path d="m18 15-6-6-6 6"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className="w-5 h-5 text-gray-600"
  >
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({ title, isOpen, onToggle, children }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg text-xs md:text-sm w-full md:w-64 overflow-hidden
                  backdrop-blur-md bg-opacity-90">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <h2 className="font-bold text-base md:text-lg">{title}</h2>
        {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>
      {isOpen && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default function Page() {
  const mountRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [glbLoaded, setGlbLoaded] = useState<boolean>(false);
  const [fileInfo, setFileInfo] = useState<FileInfo>({
    totalSize: 0,
    components: {
      geometries: 0,
      textures: 0,
      animations: 0,
      others: 0
    }
  });
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    geometryTotal: 0,
    textureTotal: 0,
    materialTotal: 0,
    vertices: 0,
    polygons: 0,
    textures: {
      count: 0,
      memory: 0
    },
    uvMaps: 0,
    normals: 0,
    tangents: 0,
    indices: 0,
    attributes: {
      count: 0,
      memory: 0
    },
    materials: {
      count: 0,
      memory: 0
    },
    totalMemory: 0
  });
  const [renderInfo, setRenderInfo] = useState<RenderInfo>({
    triangles: 0,
    calls: 0,
    lines: 0,
    points: 0,
    drawCalls: 0
  });
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Collapsible states
  const [isFileInfoOpen, setIsFileInfoOpen] = useState(true);
  const [isMemoryUsageOpen, setIsMemoryUsageOpen] = useState(true);
  const [isRenderInfoOpen, setIsRenderInfoOpen] = useState(true);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const statsRef = useRef<Stats | null>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const analyzeBinaryFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const glbData = new DataView(arrayBuffer);
    
    // GLB 포맷 검증
    if (glbData.getUint32(0, true) !== 0x46546C67) {
      throw new Error('Invalid GLB format');
    }
    
    if (glbData.getUint32(4, true) !== 2) {
      throw new Error('Unsupported GLB version');
    }

    const totalLength = glbData.getUint32(8, true);
    
    let offset = 12;
    let geometriesSize = 0;
    let texturesSize = 0;
    let animationsSize = 0;
    let othersSize = 0;

    while (offset < totalLength) {
      const chunkLength = glbData.getUint32(offset, true);
      const chunkType = glbData.getUint32(offset + 4, true);
      
      if (chunkType === 0x4E4F534A) {
        const jsonChunk = new TextDecoder().decode(
          arrayBuffer.slice(offset + 8, offset + 8 + chunkLength)
        );
        const jsonData = JSON.parse(jsonChunk) as JsonData;
        
        if (jsonData.bufferViews) {
          jsonData.bufferViews.forEach((view: BufferView) => {
            if (view.target === 34962) {
              geometriesSize += view.byteLength;
            } else if (view.target === 34963) {
              geometriesSize += view.byteLength;
            }
          });
        }
        
        if (jsonData.images) {
          texturesSize = jsonData.images.reduce((acc: number, img: GltfImage) => {
            return acc + (img.bufferView && jsonData.bufferViews 
              ? jsonData.bufferViews[img.bufferView].byteLength 
              : 0);
          }, 0);
        }
        
        if (jsonData.animations) {
          animationsSize = jsonData.animations.reduce((acc: number, anim: GltfAnimation) => {
            let size = 0;
            anim.channels?.forEach((channel: GltfChannel) => {
              if (channel.sampler !== undefined && jsonData.accessors && jsonData.accessors[channel.sampler]) {
                const accessor = jsonData.accessors[channel.sampler];
                if (accessor.bufferView !== undefined && jsonData.bufferViews) {
                  size += jsonData.bufferViews[accessor.bufferView].byteLength;
                }
              }
            });
            return acc + size;
          }, 0);
        }
      }
      
      offset += 8 + chunkLength;
    }
    
    othersSize = totalLength - (geometriesSize + texturesSize + animationsSize);
    
    setFileInfo({
      totalSize: totalLength,
      components: {
        geometries: geometriesSize,
        textures: texturesSize,
        animations: animationsSize,
        others: othersSize
      }
    });
  };

  const openFileDialog = () => inputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      await analyzeBinaryFile(file);
      loadGLBModel(url);
      setGlbLoaded(true);
    }
    
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleResize = () => {
    if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  };

  const calculateBufferSize = (buffer: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number => {
    return buffer.array.byteLength;
  };

  const calculateGeometryMemory = (geometry: THREE.BufferGeometry): number => {
    let memory = 0;

    if (geometry.index) {
      memory += calculateBufferSize(geometry.index);
    }

    for (const name in geometry.attributes) {
      const attribute = geometry.attributes[name];
      memory += calculateBufferSize(attribute);
    }

    return memory;
  };

  const calculateTextureMemory = (texture: THREE.Texture): number => {
    if (!texture.image) return 0;
    
    const { width, height } = texture.image;
    const bytesPerPixel = texture.format === THREE.RGBAFormat ? 4 : 3;
    return width * height * bytesPerPixel;
  };

  const calculateMaterialMemory = (material: THREE.Material): number => {
    let memory = 0;
    
    memory += 1024;

    if ('map' in material) {
      const materialWithMap = material as THREE.MeshStandardMaterial;
      if (materialWithMap.map) {
        memory += calculateTextureMemory(materialWithMap.map);
      }
      if (materialWithMap.normalMap) {
        memory += calculateTextureMemory(materialWithMap.normalMap);
      }
      if (materialWithMap.roughnessMap) {
        memory += calculateTextureMemory(materialWithMap.roughnessMap);
      }
      if (materialWithMap.metalnessMap) {
        memory += calculateTextureMemory(materialWithMap.metalnessMap);
      }
    }

    return memory;
  };

  const updateMemoryUsage = (object: THREE.Object3D) => {
    const memoryData: MemoryInfo = {  // let를 const로 변경
      geometryTotal: 0,
      textureTotal: 0,
      materialTotal: 0,
      vertices: 0,
      polygons: 0,
      textures: {
        count: 0,
        memory: 0
      },
      uvMaps: 0,
      normals: 0,
      tangents: 0,
      indices: 0,
      attributes: {
        count: 0,
        memory: 0
      },
      materials: {
        count: 0,
        memory: 0
      },
      totalMemory: 0
    };

    const processedMaterials = new Set<THREE.Material>();
    const processedTextures = new Set<THREE.Texture>();
    const processedGeometries = new Set<THREE.BufferGeometry>();

    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry;
        const material = Array.isArray(child.material) ? child.material : [child.material];

        if (!processedGeometries.has(geometry)) {
          processedGeometries.add(geometry);
          const geometryMemory = calculateGeometryMemory(geometry);
          memoryData.geometryTotal += geometryMemory;
          memoryData.vertices += geometry.attributes.position?.count || 0;
          memoryData.polygons += geometry.index ? geometry.index.count / 3 : 0;
          memoryData.indices += geometry.index ? geometry.index.count * 2 : 0;
          memoryData.attributes.count += Object.keys(geometry.attributes).length;
          memoryData.attributes.memory += geometryMemory;

          if (geometry.attributes.uv) {
            memoryData.uvMaps += calculateBufferSize(geometry.attributes.uv);
          }
          if (geometry.attributes.normal) {
            memoryData.normals += calculateBufferSize(geometry.attributes.normal);
          }
          if (geometry.attributes.tangent) {
            memoryData.tangents += calculateBufferSize(geometry.attributes.tangent);
          }
        }

        material.forEach(mat => {
          if (mat && !processedMaterials.has(mat)) {
            processedMaterials.add(mat);
            const materialMemory = calculateMaterialMemory(mat);
            memoryData.materialTotal += materialMemory;
            memoryData.materials.count++;
            memoryData.materials.memory += materialMemory;

            if ('map' in mat) {
              const materialWithMap = mat as THREE.MeshStandardMaterial;
              [
                materialWithMap.map,
                materialWithMap.normalMap,
                materialWithMap.roughnessMap,
                materialWithMap.metalnessMap
              ].forEach(texture => {
                if (texture && !processedTextures.has(texture)) {
                  processedTextures.add(texture);
                  const textureMemory = calculateTextureMemory(texture);
                  memoryData.textureTotal += textureMemory;
                  memoryData.textures.count++;
                  memoryData.textures.memory += textureMemory;
                }
              });
            }
          }
        });
      }
    });
 
    memoryData.totalMemory = memoryData.geometryTotal + memoryData.textureTotal + memoryData.materialTotal;
    setMemoryInfo(memoryData);
  };
 
  const loadGLBModel = (url: string) => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;
 
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current ? mountRef.current.clientWidth / mountRef.current.clientHeight : 1,
      0.1,
      1000
    );
    cameraRef.current = camera;
    camera.position.set(0, 1, 5);
 
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    });
    rendererRef.current = renderer;
    
    if (mountRef.current) {
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mountRef.current.appendChild(renderer.domElement);
    }
 
    const stats = new Stats();
    statsRef.current = stats;
    stats.dom.style.position = 'absolute';
    stats.dom.style.left = isMobile ? '16px' : '272px';
    stats.dom.style.top = isMobile ? '200px' : '16px';
    stats.dom.style.transform = isMobile ? 'scale(1.2)' : 'scale(1.5)';
    stats.dom.style.transformOrigin = 'top left';
    mountRef.current?.appendChild(stats.dom);
 
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
 
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
 
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);
 
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
 
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = child.material as THREE.MeshStandardMaterial;
            material.transparent = false;
            material.opacity = 1.0;
            material.side = THREE.DoubleSide;
            material.depthWrite = true;
            material.depthTest = true;
          }
        });
 
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center);
 
        scene.add(model);
        updateMemoryUsage(model);
 
        const size = box.getSize(new THREE.Vector3()).length();
        const distance = Math.abs(size / (2 * Math.tan((camera.fov * Math.PI) / 360)));
        camera.position.set(0, 0, distance);
 
        camera.lookAt(0, 0, 0);
        controls.update();
      },
      undefined,
      (error) => console.error("Error loading GLB model:", error)
    );
 
    const updateRenderInfo = () => {
      const info = renderer.info;
      setRenderInfo({
        triangles: info.render.triangles,
        calls: info.render.calls,
        lines: info.render.lines,
        points: info.render.points,
        drawCalls: info.programs?.length || 0
      });
    };
 
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      stats.update();
      updateRenderInfo();
    };
    animate();
 
    window.addEventListener('resize', handleResize);
  };
 
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
 
  const handleBack = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
 
    if (sceneRef.current) {
      while (sceneRef.current.children.length > 0) {
        sceneRef.current.remove(sceneRef.current.children[0]);
      }
    }
 
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
 
    if (statsRef.current?.dom && mountRef.current?.contains(statsRef.current.dom)) {
      mountRef.current.removeChild(statsRef.current.dom);
    }
    statsRef.current = null;
 
    window.removeEventListener('resize', handleResize);
 
    setGlbLoaded(false);
    setFileInfo({
      totalSize: 0,
      components: {
        geometries: 0,
        textures: 0,
        animations: 0,
        others: 0
      }
    });
    setMemoryInfo({
      geometryTotal: 0,
      textureTotal: 0,
      materialTotal: 0,
      vertices: 0,
      polygons: 0,
      textures: {
        count: 0,
        memory: 0
      },
      uvMaps: 0,
      normals: 0,
      tangents: 0,
      indices: 0,
      attributes: {
        count: 0,
        memory: 0
      },
      materials: {
        count: 0,
        memory: 0
      },
      totalMemory: 0
    });
    setRenderInfo({
      triangles: 0,
      calls: 0,
      lines: 0,
      points: 0,
      drawCalls: 0
    });
 
    if (mountRef.current) {
      mountRef.current.innerHTML = "";
    }
  };
 
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);
 
  return (
    <div className="relative w-full h-screen bg-gray-100">
      {!glbLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={openFileDialog}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 active:bg-blue-700 
                     transition-colors duration-200 text-sm md:text-base"
          >
            Upload GLB
          </button>
          <input 
            type="file" 
            accept=".glb" 
            ref={inputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </div>
      )}
 
      {glbLoaded && (
        <>
          <div className="absolute left-4 top-4 z-10">
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-red-500 text-white rounded-md shadow-lg hover:bg-red-600 active:bg-red-700
                       transition-colors duration-200 text-sm md:text-base"
            >
              Back
            </button>
          </div>
 
          <div className={`absolute ${isMobile ? 'bottom-4 left-4 right-4' : 'left-4 top-20'} 
                          flex flex-col gap-4`}>
            <CollapsiblePanel
              title="File Information"
              isOpen={isFileInfoOpen}
              onToggle={() => setIsFileInfoOpen(!isFileInfoOpen)}
            >
              <div className="space-y-3">
                <div className="border-b pb-2">
                  <h3 className="font-semibold">Total File Size: {formatBytes(fileInfo.totalSize)}</h3>
                </div>
                
                <div>
                  <h3 className="font-semibold">Components</h3>
                  <ul className="ml-2 space-y-1">
                    <li>Geometries: {formatBytes(fileInfo.components.geometries)} ({((fileInfo.components.geometries / fileInfo.totalSize) * 100).toFixed(1)}%)</li>
                    <li>Textures: {formatBytes(fileInfo.components.textures)} ({((fileInfo.components.textures / fileInfo.totalSize) * 100).toFixed(1)}%)</li>
                    <li>Animations: {formatBytes(fileInfo.components.animations)} ({((fileInfo.components.animations / fileInfo.totalSize) * 100).toFixed(1)}%)</li>
                    <li>Others: {formatBytes(fileInfo.components.others)} ({((fileInfo.components.others / fileInfo.totalSize) * 100).toFixed(1)}%)</li>
                  </ul>
                </div>
              </div>
            </CollapsiblePanel>
 
            <CollapsiblePanel
              title="Memory Usage"
              isOpen={isMemoryUsageOpen}
              onToggle={() => setIsMemoryUsageOpen(!isMemoryUsageOpen)}
            >
              <div className="space-y-3">
                <div className="border-b pb-2">
                  <h3 className="font-semibold">Total Memory: {formatBytes(memoryInfo.totalMemory)}</h3>
                </div>
                
                <div>
                  <h3 className="font-semibold">Geometry ({formatBytes(memoryInfo.geometryTotal)})</h3>
                  <ul className="ml-2 space-y-1">
                    <li>Vertices: {memoryInfo.vertices.toLocaleString()}</li>
                    <li>Polygons: {memoryInfo.polygons.toLocaleString()}</li>
                    <li>Indices: {formatBytes(memoryInfo.indices)}</li>
                    <li>UV Maps: {formatBytes(memoryInfo.uvMaps)}</li>
                    <li>Normals: {formatBytes(memoryInfo.normals)}</li>
                    <li>Tangents: {formatBytes(memoryInfo.tangents)}</li>
                    <li>Attributes: {memoryInfo.attributes.count} ({formatBytes(memoryInfo.attributes.memory)})</li>
                  </ul>
                </div>
 
                <div>
                  <h3 className="font-semibold">Textures ({formatBytes(memoryInfo.textureTotal)})</h3>
                  <ul className="ml-2 space-y-1">
                    <li>Count: {memoryInfo.textures.count}</li>
                    <li>Memory: {formatBytes(memoryInfo.textures.memory)}</li>
                  </ul>
                </div>
 
                <div>
                  <h3 className="font-semibold">Materials ({formatBytes(memoryInfo.materialTotal)})</h3>
                  <ul className="ml-2 space-y-1">
                    <li>Count: {memoryInfo.materials.count}</li>
                    <li>Memory: {formatBytes(memoryInfo.materials.memory)}</li>
                  </ul>
                </div>
              </div>
            </CollapsiblePanel>
 
            <CollapsiblePanel
              title="Render Info"
              isOpen={isRenderInfoOpen}
              onToggle={() => setIsRenderInfoOpen(!isRenderInfoOpen)}
            >
              <ul className="space-y-1">
                <li>Triangles: {renderInfo.triangles.toLocaleString()}</li>
                <li>Draw Calls: {renderInfo.calls}</li>
                <li>Lines: {renderInfo.lines}</li>
                <li>Points: {renderInfo.points}</li>
                <li>Shader Programs: {renderInfo.drawCalls}</li>
              </ul>
            </CollapsiblePanel>
          </div>
        </>
      )}
 
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
 }