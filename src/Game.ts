import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { fragmentShader } from './shaders/FragmentShader';
import { vertexShader } from './shaders/VertexShader';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import Bird from './Bird';

const BLOOM_SCENE = 1;

export default class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private finalComposer: EffectComposer
    private renderScene: RenderPass
    private outputPass: OutputPass
    private loader: GLTFLoader;
    private controls: OrbitControls;
    private clock: THREE.Clock;

    private bloomPass: UnrealBloomPass;
    private bloomComposer: EffectComposer;
    private mixPass: any;
    private bloomLayer: THREE.Layers;
    private materials: any;
    
    bird: Bird;
    private birdModel?: THREE.Object3D;
    private birdMixer?: THREE.AnimationMixer;

    private floorModel?: THREE.Object3D;
    private floorMixer?: THREE.AnimationMixer;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas') as HTMLCanvasElement });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.loader = new GLTFLoader();
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.clock = new THREE.Clock();
        this.materials = [];

        this.renderScene = new RenderPass(this.scene, this.camera);
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth * 1.5, window.innerHeight), 1.5, 0.4, 0.85);

        this.bloomComposer = new EffectComposer( this.renderer );
        this.bloomComposer.renderToScreen = false;
        this.bloomComposer.addPass(this.renderScene);
        this.bloomComposer.addPass(this.bloomPass);
        
        this.mixPass = new ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: { value: null },
                    bloomTexture: { value: this.bloomComposer.renderTarget2.texture }
                },
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                defines: {}
            }), "baseTexture"
        );
        this.mixPass.needsSwap = true;

        this.outputPass = new OutputPass();

        this.finalComposer = new EffectComposer( this.renderer );

        this.finalComposer.addPass(this.renderScene);
        this.finalComposer.addPass(this.mixPass);
        this.finalComposer.addPass(this.outputPass);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = Math.pow(0.68, 5.0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.bloomLayer = new THREE.Layers();
        this.bloomLayer.set(BLOOM_SCENE);

        const environment = new RoomEnvironment( this.renderer );
        const pmremGenerator = new THREE.PMREMGenerator( this.renderer );

        this.scene.environment = pmremGenerator.fromScene( environment ).texture;
        
        this.bird = new Bird(0, 0);

        const sphereGeometry = new THREE.SphereGeometry( 500, 60, 40 );
        // invert the geometry on the x-axis so that all of the faces point inward
        sphereGeometry.scale( -1, 1, 1 );
        sphereGeometry.rotateY(-Math.PI / 2);

        const sphereTexture = new THREE.TextureLoader().load( 'src/assets/daniel-glebinski-bg-04.jpg' );
        sphereTexture.colorSpace = THREE.SRGBColorSpace;
        const sphereMaterial = new THREE.MeshBasicMaterial( { map: sphereTexture } );

        const mesh = new THREE.Mesh( sphereGeometry, sphereMaterial );

        this.scene.add( mesh );

        this.loader.load('src/assets/phoenix_bird/scene.gltf', (gltf) => {
            this.birdModel = gltf.scene;
            this.birdModel.scale.set(0.005, 0.005, 0.005);
            this.birdModel.rotateY(Math.PI / 2);
            
            this.birdModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.layers.enable(BLOOM_SCENE);
                }
            });

            this.birdMixer = new THREE.AnimationMixer( gltf.scene );
            let action = this.birdMixer.clipAction( gltf.animations[0] );
            action.play();

            this.scene.add(gltf.scene);
        }, undefined, (error) => {
            console.error(error);
        });

        this.loader.load('src/assets/endless_floor_vr/scene.gltf', (gltf) => {
            // const newMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });

            this.floorModel = gltf.scene;
            this.floorModel.scale.set(5, 5, 5);
            this.floorModel.position.set(0, 0, -50);

            this.floorModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.layers.enable(BLOOM_SCENE);
                    child.material.emissive = new THREE.Color(0xffffff);
                    child.material.emissiveIntensity = 5;
                }
            });

            this.floorMixer = new THREE.AnimationMixer( gltf.scene );
            let action = this.floorMixer.clipAction( gltf.animations[0] );
            action.play();

            this.scene.add(gltf.scene);
        }, undefined, (error) => {
            console.error(error);
        });

        this.camera.position.y = 3;
        this.camera.position.z = 5;
        this.camera.lookAt(0, 0, 0);

        // Resize canvas on window resize
        window.addEventListener('resize', () => {
            const canvas = document.getElementById('canvas') as HTMLCanvasElement;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }

    public start() {
        this.animate();
    }

    private animate() {
        var delta = this.clock.getDelta();

        // Bird animation
        if ( this.birdMixer ) this.birdMixer.update( delta );

        this.moveBird();

        // Floor animation
        if ( this.floorMixer ) this.floorMixer.update( delta * 5 );
        
        this.controls.update();

        this.scene.traverse(this.nonBloomed.bind(this));
        this.bloomComposer.render();
        this.scene.traverse(this.restoreMaterial.bind(this));
        this.finalComposer.render();

        // this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(this.animate.bind(this));
    }

    
    private nonBloomed(obj: any) {
        if (obj.isMesh && this.bloomLayer.test(obj.layers) === false) {
            this.materials[obj.uuid] = obj.material;
            obj.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
        }
    }

    private restoreMaterial(obj: any) {
        if (this.materials[obj.uuid]) {
            obj.material = this.materials[obj.uuid];
            delete this.materials[obj.uuid];
        }
    }

    private moveBird() {
        this.birdModel?.position.set(this.bird.getPosition().x, this.bird.getPosition().y, 0);
        this.bird.move();
    }
}