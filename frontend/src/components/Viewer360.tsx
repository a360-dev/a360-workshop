import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Billboard } from '@react-three/drei';
import { VRButton, XR, Controllers, Hands } from '@react-three/xr';
import * as THREE from 'three';
import { useMemo, useState, useRef } from 'react';
import { cn, getAssetUrl } from '@/lib/utils';

interface Viewer360Props {
    panoUrl: string; // Base URL for the 6 faces
    hotspots?: any[];
    onAddHotspot?: (yaw: number, pitch: number) => void;
    onNavigate?: (targetID: string) => void;
    onInfoClick?: (hotspot: any) => void;
    onEditHotspot?: (hotspot: any) => void;
}

export default function Viewer360({ panoUrl, hotspots, onAddHotspot, onNavigate, onInfoClick, onEditHotspot }: Viewer360Props) {
    const [isTransitioning, setIsTransitioning] = useState(false);

    console.log('[DEBUG-VIEWER-V7] panoUrl:', panoUrl);

    // Faces: posx, negx, posy, negy, posz, negz
    const textures = useMemo(() => {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        const faces = ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'];
        const texs = faces.map(face => {
            const rawUrl = `${panoUrl}/${face}.jpg`;
            const finalUrl = getAssetUrl(rawUrl);
            console.log(`[DEBUG-FACE-V7] ${face} ->`, finalUrl);
            const t = loader.load(finalUrl);
            // Seam fix: Disable mipmapping and set wrapping to clamp
            t.generateMipmaps = false;
            t.minFilter = THREE.LinearFilter;
            t.magFilter = THREE.LinearFilter;
            t.wrapS = THREE.ClampToEdgeWrapping;
            t.wrapT = THREE.ClampToEdgeWrapping;
            return t;
        });
        return texs;
    }, [panoUrl]);

    const lastPointerDown = useRef<{ x: number, y: number, time: number } | null>(null);

    const handleTransitionNavigate = (targetID: string) => {
        setIsTransitioning(true);
        // Step 1: Rapid Zoom & Blur starts (handled by TransitionManager and CSS)

        // Step 2: Swap Scene after animation peak
        setTimeout(() => {
            onNavigate?.(targetID);

            // Step 3: Fade out blur after brief hold on new scene
            setTimeout(() => {
                setIsTransitioning(false);
            }, 600);
        }, 400);
    };

    return (
        <>
            <VRButton />
            {/* Blur Overlay */}
            <div className={cn(
                "absolute inset-0 z-20 pointer-events-none transition-all duration-500 ease-in-out",
                isTransitioning ? "backdrop-blur-xl bg-white/5 opacity-100" : "backdrop-blur-0 bg-transparent opacity-0"
            )} />

            <Canvas style={{ height: '100vh', background: '#000' }} gl={{ toneMapping: THREE.NoToneMapping }}>
                <XR>
                    <Controllers />
                    <Hands />
                    <PerspectiveCamera makeDefault position={[0, 0, -0.1]} fov={100} />
                    <TransitionManager active={isTransitioning} />
                    <OrbitControls
                        enableZoom={true}
                        enablePan={false}
                        rotateSpeed={-0.5}
                        minDistance={0.01}
                        maxDistance={5}
                        key={panoUrl} // Re-bind on URL change to maintain orientation
                    />
                    <ZoomClamper min={90} max={120} />

                    <mesh
                        scale={[-1, 1, 1]}
                        onPointerDown={(e) => {
                            lastPointerDown.current = { x: e.screenX, y: e.screenY, time: Date.now() };
                        }}
                        onPointerUp={(e) => {
                            if (!lastPointerDown.current) return;
                            const dx = e.screenX - lastPointerDown.current.x;
                            const dy = e.screenY - lastPointerDown.current.y;
                            const dt = Date.now() - lastPointerDown.current.time;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            // Increased threshold for better cross-device compatibility
                            if (dist < 20 && dt < 400) {
                                if (e.stopPropagation) e.stopPropagation();
                                const point = e.point.clone().normalize();
                                const yaw = Math.atan2(point.x, point.z) * (180 / Math.PI);
                                const pitch = Math.asin(point.y) * (180 / Math.PI);
                                onAddHotspot?.(yaw, pitch);
                            }
                            lastPointerDown.current = null;
                        }}
                    >
                        <boxGeometry args={[10, 10, 10]} />
                        {textures.map((tex, i) => (
                            <meshBasicMaterial key={i} attach={`material-${i}`} map={tex} side={THREE.BackSide} />
                        ))}
                    </mesh>

                    {hotspots?.map((hs, i) => {
                        // Convert yaw/pitch back to vector on a sphere of radius 3.5
                        const phi = (90 - hs.pitch) * (Math.PI / 180);
                        const theta = (hs.yaw) * (Math.PI / 180);
                        const radius = 3.5;
                        const x = radius * Math.sin(phi) * Math.sin(theta);
                        const y = radius * Math.cos(phi);
                        const z = radius * Math.sin(phi) * Math.cos(theta);

                        // Use correct field names from backend JSON tags
                        const isFloorSpot = hs.type === 'scene' || (hs.target_scene_id && hs.target_scene_id !== "");

                        if (isFloorSpot) {
                            return (
                                <FloorSpot
                                    key={hs.id || `fs-${i}`}
                                    position={[x, y, z]}
                                    onClick={(e: any) => {
                                        e.stopPropagation();
                                        if (onEditHotspot) {
                                            onEditHotspot(hs);
                                        } else if (hs.target_scene_id) {
                                            handleTransitionNavigate(hs.target_scene_id);
                                        }
                                    }}
                                />
                            );
                        }

                        // Default Info Spot (Spot with Ring)
                        return (
                            <InfoSpot
                                key={hs.id || `is-${i}`}
                                position={[x, y, z]}
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    if (onEditHotspot) {
                                        onEditHotspot(hs);
                                    } else {
                                        onInfoClick?.(hs);
                                    }
                                }}
                            />
                        );
                    })}
                </XR>
            </Canvas>
        </>
    );
}

function InfoSpot({ position, onClick }: any) {
    const [hovered, setHovered] = useState(false);
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (ringRef.current) {
            // Breathing animation: oscillate scale slightly
            const scale = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.15;
            ringRef.current.scale.set(scale, scale, 1);
        }
    });

    return (
        <group position={position}>
            <Billboard>
                {/* Minimal Outer Ring (Breathing) */}
                <mesh ref={ringRef} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                    <ringGeometry args={[0.08, 0.12, 32]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} />
                </mesh>
                {/* Center Spot */}
                <mesh
                    onClick={onClick}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onPointerOver={() => setHovered(true)}
                    onPointerOut={() => setHovered(false)}
                >
                    <circleGeometry args={[0.06, 32]} />
                    <meshBasicMaterial
                        color={hovered ? "#3b82f6" : "#ffffff"}
                        transparent
                        opacity={hovered ? 1.0 : 0.8}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </Billboard>
        </group>
    );
}

function TransitionManager({ active }: { active: boolean }) {
    const { camera } = useThree();
    const targetFOV = active ? 40 : 100;

    useFrame(() => {
        // Rapid interpolation for high-energy motion
        if (Math.abs((camera as THREE.PerspectiveCamera).fov - targetFOV) > 0.01) {
            (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp((camera as THREE.PerspectiveCamera).fov, targetFOV, 0.15);
            camera.updateProjectionMatrix();
        }
    });

    return null;
}

function ZoomClamper({ min, max }: { min: number, max: number }) {
    const { camera } = useThree();
    useFrame(() => {
        const cam = camera as THREE.PerspectiveCamera;
        if (cam.fov < min) {
            cam.fov = min;
            cam.updateProjectionMatrix();
        }
        if (cam.fov > max) {
            cam.fov = max;
            cam.updateProjectionMatrix();
        }
    });
    return null;
}

function FloorSpot({ position, onClick }: any) {
    const [hovered, setHovered] = useState(false);

    // To make it look "flat" on the floor regardless of where it is on the sphere,
    // we should ideally orient it to face the center or stay horizontal.
    // Matterport style is horizontal.
    return (
        <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
            {/* Primary Ring */}
            <mesh
                onClick={onClick}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <ringGeometry args={[0.225, 0.33, 64]} />
                <meshBasicMaterial
                    color={hovered ? "#3b82f6" : "#ffffff"}
                    transparent
                    opacity={hovered ? 1.0 : 0.5}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Inner Glow/Fill */}
            <mesh
                onClick={onClick}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <circleGeometry args={[0.225, 64]} />
                <meshBasicMaterial
                    color={hovered ? "#3b82f6" : "#ffffff"}
                    transparent
                    opacity={hovered ? 0.3 : 0.1}
                    side={THREE.DoubleSide}
                />
            </mesh>
            {/* Arrow/Indicator (Optional Matterport Detail) */}
            {hovered && (
                <mesh position={[0, 0, 0.01]} rotation={[0, 0, 0]}>
                    <ringGeometry args={[0.375, 0.405, 64]} />
                    <meshBasicMaterial color="#3b82f6" transparent opacity={0.5} />
                </mesh>
            )}
        </group>
    );
}
