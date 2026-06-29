/**
 * fix_seats_3d.js — Rewrites init3DView() with:
 *  1. Dynamic screen width matched to seat cluster
 *  2. Camera perfectly centered (theta=PI, phi=0.62) — no more tilt
 *  3. Walls, floor, lights scale with seat layout
 *  4. Screen stays as-is, seat grid proportional
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'seats.html');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// Find init3DView boundaries
let startLine = -1, endLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function init3DView()') && startLine === -1) {
        startLine = i;
    }
    if (startLine !== -1 && i > startLine) {
        if (/^        \}$/.test(lines[i])) { endLine = i; break; }
    }
}
console.log(`init3DView: lines ${startLine+1} to ${endLine+1}`);

const newFn = `        function init3DView() {
            const container = document.getElementById('seat3DCanvas');
            if (!container) return;
            if (!window.THREE) {
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:560px;color:#aaa;">Không thể tải thư viện 3D.</div>';
                return;
            }
            if (!seatsList || seatsList.length === 0) {
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:560px;color:#888;">Chưa có dữ liệu ghế</div>';
                return;
            }

            if (three3D && three3D.destroy) three3D.destroy();
            three3D = null;
            container.innerHTML = '';
            container.style.height = '640px';
            container.style.borderRadius = '18px';
            container.style.overflow = 'hidden';
            container.style.boxShadow = '0 0 60px rgba(30,80,200,0.25)';

            // ============================================================
            // SCENE
            // ============================================================
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x05070d);
            scene.fog = new THREE.FogExp2(0x05070d, 0.010);

            // ============================================================
            // PRE-CALCULATE SEAT LAYOUT DIMENSIONS
            // (must be done BEFORE building scene so screen width matches)
            // ============================================================
            const rowsMap = {};
            seatsList.forEach(s => {
                if (!rowsMap[s.SeatRow]) rowsMap[s.SeatRow] = [];
                rowsMap[s.SeatRow].push(s);
            });
            const sortedRows = Object.keys(rowsMap).sort();
            const totalRows  = sortedRows.length;

            const SEAT_STEP = 1.08;
            const ROW_STEP  = 1.35;
            const SCREEN_Z  = 0;
            const FIRST_Z   = 10.0;

            // Find max seats in any row
            let maxSeatsInRow = 0;
            sortedRows.forEach(row => {
                maxSeatsInRow = Math.max(maxSeatsInRow, rowsMap[row].length);
            });
            // Seat cluster total width (including center aisle gap ~0.5)
            const SEAT_CLUSTER_W = maxSeatsInRow * SEAT_STEP + 0.5;

            // Screen dimensions — width matches seat cluster + comfortable padding
            const SW = Math.max(16, SEAT_CLUSTER_W + 4.0);
            const SH = 6.5;

            // Wall half-width — give some breathing room past seats
            const HALF_WALL = SW / 2 + 5.0;
            const ROOM_DEPTH = FIRST_Z + totalRows * ROW_STEP + 12;

            // ============================================================
            // LIGHTS
            // ============================================================
            scene.add(new THREE.AmbientLight(0x111830, 1.4));

            // Key: from screen (front-top)
            const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
            keyLight.position.set(0, 25, -10);
            scene.add(keyLight);

            // Fill: from back
            const fillLight = new THREE.DirectionalLight(0x2244aa, 0.6);
            fillLight.position.set(0, 10, 30);
            scene.add(fillLight);

            // Screen glow
            const screenGlow = new THREE.PointLight(0x99bbff, 5.0, 40);
            screenGlow.position.set(0, 7, 0.5);
            scene.add(screenGlow);

            // Ceiling strip lights — spread across seat width
            const ceilL1 = new THREE.PointLight(0xffeedd, 1.2, 30);
            ceilL1.position.set(-SEAT_CLUSTER_W * 0.3, 14, FIRST_Z + totalRows * ROW_STEP * 0.5);
            scene.add(ceilL1);
            const ceilL2 = new THREE.PointLight(0xffeedd, 1.2, 30);
            ceilL2.position.set( SEAT_CLUSTER_W * 0.3, 14, FIRST_Z + totalRows * ROW_STEP * 0.5);
            scene.add(ceilL2);

            // Wall accent
            const wallL = new THREE.PointLight(0xff1833, 1.0, 28);
            wallL.position.set(-HALF_WALL + 1.5, 4, FIRST_Z + totalRows * ROW_STEP * 0.4);
            scene.add(wallL);
            const wallR = new THREE.PointLight(0x1155ff, 1.0, 28);
            wallR.position.set( HALF_WALL - 1.5, 4, FIRST_Z + totalRows * ROW_STEP * 0.4);
            scene.add(wallR);

            // ============================================================
            // CAMERA & RENDERER
            // ============================================================
            const CW = container.clientWidth || 900;
            const CH = 640;
            const camera = new THREE.PerspectiveCamera(46, CW / CH, 0.1, 300);
            const renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(CW, CH);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            container.appendChild(renderer.domElement);

            // ============================================================
            // CANVAS LABEL HELPER
            // ============================================================
            function makeTexture(text, opts) {
                opts = opts || {};
                const W = opts.w || 512, H = opts.h || 128;
                const cv = document.createElement('canvas');
                cv.width = W; cv.height = H;
                const cx = cv.getContext('2d');
                if (opts.bg) {
                    cx.fillStyle = opts.bg;
                    const r = H * 0.38;
                    cx.beginPath();
                    cx.roundRect(opts.padX||4, opts.padY||4, W-(opts.padX||4)*2, H-(opts.padY||4)*2, r);
                    cx.fill();
                }
                if (opts.shadow) { cx.shadowColor = opts.shadow; cx.shadowBlur = 12; }
                cx.font = 'bold ' + (opts.fs||56) + 'px Inter,Arial,sans-serif';
                cx.fillStyle = opts.col || '#ffffff';
                cx.textAlign = 'center';
                cx.textBaseline = 'middle';
                cx.fillText(text, W/2, H/2);
                return new THREE.CanvasTexture(cv);
            }

            // ============================================================
            // CINEMA SCREEN (width dynamically matched to seat cluster)
            // ============================================================
            const screenMesh = new THREE.Mesh(
                new THREE.BoxGeometry(SW, SH, 0.18),
                new THREE.MeshStandardMaterial({
                    color: 0xc2dcff, emissive: 0x1a3d9a,
                    emissiveIntensity: 1.4, roughness: 0.06,
                })
            );
            screenMesh.position.set(0, 5.5, SCREEN_Z);
            scene.add(screenMesh);

            // Screen frame
            const fMat = new THREE.MeshStandardMaterial({ color: 0x060810, roughness: 0.95 });
            [
                { w: SW+1.0, h: 0.5,     d: 0.3, x: 0,           y: 5.5+SH/2+0.25, z: SCREEN_Z },
                { w: SW+1.0, h: 0.5,     d: 0.3, x: 0,           y: 5.5-SH/2-0.25, z: SCREEN_Z },
                { w: 0.5,    h: SH+1.0,  d: 0.3, x:-(SW/2+0.25), y: 5.5,           z: SCREEN_Z },
                { w: 0.5,    h: SH+1.0,  d: 0.3, x: (SW/2+0.25), y: 5.5,           z: SCREEN_Z },
            ].forEach(({ w, h, d, x, y, z }) => {
                const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), fMat.clone());
                m.position.set(x,y,z); scene.add(m);
            });

            // "MÀN HÌNH" label
            const screenLbl = new THREE.Mesh(
                new THREE.PlaneGeometry(SW * 0.55, 1.6),
                new THREE.MeshBasicMaterial({
                    map: makeTexture('M\\u00c0N H\\u00ccNH', { w:768, h:192, fs:72, col:'#b8d8ff', shadow:'#0044cc' }),
                    transparent: true, depthWrite: false, side: THREE.DoubleSide,
                })
            );
            screenLbl.position.set(0, 5.5, SCREEN_Z + 0.11);
            scene.add(screenLbl);

            // Stage/podium
            const stage = new THREE.Mesh(
                new THREE.BoxGeometry(SW+3, 1.5, 4.5),
                new THREE.MeshStandardMaterial({ color: 0x0c0e18, roughness: 0.92 })
            );
            stage.position.set(0, 0.55, SCREEN_Z + 2.0);
            scene.add(stage);

            // ============================================================
            // FLOOR — dark carpet
            // ============================================================
            const floor = new THREE.Mesh(
                new THREE.PlaneGeometry(HALF_WALL * 2 + 4, ROOM_DEPTH + 10),
                new THREE.MeshStandardMaterial({ color: 0x100810, roughness: 0.98 })
            );
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(0, -0.02, ROOM_DEPTH / 2);
            scene.add(floor);

            // Center aisle carpet runner
            const carpet = new THREE.Mesh(
                new THREE.PlaneGeometry(1.2, ROOM_DEPTH + 10),
                new THREE.MeshStandardMaterial({ color: 0x180c0c, roughness: 1.0 })
            );
            carpet.rotation.x = -Math.PI / 2;
            carpet.position.set(0, 0.01, ROOM_DEPTH / 2);
            scene.add(carpet);

            // ============================================================
            // WALLS — sized to room
            // ============================================================
            const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18, roughness: 0.9 });
            const wL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 18, ROOM_DEPTH + 8), wallMat.clone());
            wL.position.set(-HALF_WALL, 9, ROOM_DEPTH / 2); scene.add(wL);
            const wR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 18, ROOM_DEPTH + 8), wallMat.clone());
            wR.position.set( HALF_WALL, 9, ROOM_DEPTH / 2); scene.add(wR);
            // Back wall and ceiling removed — open-top cinematic look

            // Wall light strips
            const stripMat  = new THREE.MeshStandardMaterial({ color: 0x220011, emissive: 0xff2244, emissiveIntensity: 0.7 });
            const stripMatB = new THREE.MeshStandardMaterial({ color: 0x001122, emissive: 0x2244ff, emissiveIntensity: 0.7 });
            for (let si = 0; si < 5; si++) {
                const zPos = FIRST_Z + si * (totalRows * ROW_STEP / 5);
                const sL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 6), stripMat.clone());
                sL.position.set(-HALF_WALL + 0.3, 3 + si * 2.2, zPos); scene.add(sL);
                const sR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 6), stripMatB.clone());
                sR.position.set( HALF_WALL - 0.3, 3 + si * 2.2, zPos); scene.add(sR);
            }

            // ============================================================
            // ENTRY / EXIT DOORS
            // ============================================================
            function makeDoor(x, z, label, color, glowColor) {
                const doorMat  = new THREE.MeshStandardMaterial({ color: 0x0c101c, roughness: 0.85 });
                const frameMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.4 });
                const doorW = 2.0, doorH = 3.8;
                const topBar = new THREE.Mesh(new THREE.BoxGeometry(doorW+0.4, 0.28, 0.32), frameMat.clone());
                topBar.position.set(x, doorH + 0.14, z); scene.add(topBar);
                const lPost = new THREE.Mesh(new THREE.BoxGeometry(0.22, doorH, 0.32), frameMat.clone());
                lPost.position.set(x - doorW/2 - 0.11, doorH/2, z); scene.add(lPost);
                const rPost = new THREE.Mesh(new THREE.BoxGeometry(0.22, doorH, 0.32), frameMat.clone());
                rPost.position.set(x + doorW/2 + 0.11, doorH/2, z); scene.add(rPost);
                const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.14), doorMat);
                panel.position.set(x, doorH/2, z); scene.add(panel);
                const signMat = new THREE.MeshStandardMaterial({ color: glowColor, emissive: glowColor, emissiveIntensity: 1.5 });
                const sign = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.9, 0.5, 0.22), signMat);
                sign.position.set(x, doorH + 0.55, z); scene.add(sign);
                const signLbl = new THREE.Mesh(
                    new THREE.PlaneGeometry(doorW * 0.85, 0.42),
                    new THREE.MeshBasicMaterial({
                        map: makeTexture(label, { w:512, h:128, fs:58, col:'#ffffff', shadow:'#000', bg:'transparent' }),
                        transparent: true, depthWrite: false, side: THREE.DoubleSide,
                    })
                );
                signLbl.position.set(x, doorH + 0.55, z + 0.13); scene.add(signLbl);
                const dLight = new THREE.PointLight(glowColor, 1.5, 8);
                dLight.position.set(x, doorH + 1, z + 0.5); scene.add(dLight);
            }

            const doorOffX = SW / 2 - 2.5;
            makeDoor(-doorOffX, 5.0, 'L\\u1ed0I V\\u00c0O', 0x003300, 0x00ee44);
            makeDoor( doorOffX, 5.0, 'L\\u1ed0I V\\u00c0O', 0x003300, 0x00ee44);
            const backZ = FIRST_Z + totalRows * ROW_STEP + 4;
            makeDoor(-doorOffX, backZ, 'L\\u1ed0I THOÁT', 0x330000, 0xff3322);
            makeDoor( doorOffX, backZ, 'L\\u1ed0I THOÁT', 0x330000, 0xff3322);

            // ============================================================
            // SEAT DATA
            // ============================================================
            const coupleRowSet = new Set();
            sortedRows.forEach(row => {
                if (rowsMap[row].some(s => s.SeatType && s.SeatType.toLowerCase().includes('couple')))
                    coupleRowSet.add(row);
            });
            if (coupleRowSet.size === 0 && totalRows > 0)
                coupleRowSet.add(sortedRows[totalRows - 1]);

            // ============================================================
            // COLORS
            // ============================================================
            const CLRS = {
                normal:   [0x2a3850, 0x0a1428],
                vip:      [0x8c2200, 0x3d0e00],
                couple:   [0x7a0e42, 0x30081a],
                selected: [0xe8001a, 0x990011],
                booked:   [0x0c0f18, 0x000000],
                locked:   [0x181e2c, 0x050810],
            };

            function getSeatCK(seat) {
                if (selectedSeats.has(seat.SeatID)) return 'selected';
                if (seat.SeatStatus === 'booked') return 'booked';
                if (lockedByOthers.has(seat.SeatID)) return 'locked';
                if (seat.SeatType && seat.SeatType.toLowerCase().includes('couple')) return 'couple';
                if (seat.SeatType === 'VIP') return 'vip';
                return 'normal';
            }

            function makeSeatMat(ck) {
                return new THREE.MeshStandardMaterial({
                    color: CLRS[ck][0], emissive: CLRS[ck][1],
                    emissiveIntensity: ck === 'selected' ? 1.0 : 0.28,
                    roughness: 0.50, metalness: 0.20,
                });
            }

            const gBody  = new THREE.BoxGeometry(0.82, 0.36, 0.60);
            const gBack  = new THREE.BoxGeometry(0.82, 0.68, 0.10);
            const gArm   = new THREE.BoxGeometry(0.07, 0.30, 0.50);
            const gCBody = new THREE.BoxGeometry(1.72, 0.36, 0.60);
            const gCBack = new THREE.BoxGeometry(1.72, 0.68, 0.10);

            const meshMap = {}, dataMap = {};

            sortedRows.forEach((row, rowIdx) => {
                const seats  = [...rowsMap[row]].sort((a,b) => a.SeatNumber - b.SeatNumber);
                const nSeats = seats.length;
                const rowW   = nSeats * SEAT_STEP;
                const startX = -rowW / 2 + SEAT_STEP / 2;
                const z      = FIRST_Z + rowIdx * ROW_STEP;
                const y      = rowIdx * 0.18;   // stadium slope
                const isCouple = coupleRowSet.has(row);

                // ROW LABELS — both sides, always visible
                const lblOffX = rowW / 2 + 1.8;
                [-lblOffX, lblOffX].forEach(lx => {
                    const pillW = 1.1, pillH = 0.6;
                    const pillMat = new THREE.MeshStandardMaterial({
                        color: 0x0a1835, emissive: 0x102060, emissiveIntensity: 0.7,
                        roughness: 0.6, transparent: true, opacity: 0.88,
                    });
                    const pill = new THREE.Mesh(new THREE.BoxGeometry(pillW, pillH, 0.08), pillMat);
                    pill.position.set(lx, y + 0.72, z);
                    scene.add(pill);

                    const borderMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: 0x2255ff, emissiveIntensity: 1.2 });
                    const bTop = new THREE.Mesh(new THREE.BoxGeometry(pillW, 0.04, 0.09), borderMat.clone());
                    bTop.position.set(lx, y + 0.72 + pillH/2 - 0.02, z); scene.add(bTop);
                    const bBot = new THREE.Mesh(new THREE.BoxGeometry(pillW, 0.04, 0.09), borderMat.clone());
                    bBot.position.set(lx, y + 0.72 - pillH/2 + 0.02, z); scene.add(bBot);

                    const lbl = new THREE.Mesh(
                        new THREE.PlaneGeometry(pillW * 0.95, pillH * 0.9),
                        new THREE.MeshBasicMaterial({
                            map: makeTexture(row, { w:256, h:128, fs:96, col:'#ffffff', shadow:'#3399ff', bg:'transparent' }),
                            transparent: true, depthWrite: false, side: THREE.DoubleSide,
                        })
                    );
                    lbl.position.set(lx, y + 0.72, z + 0.05);
                    scene.add(lbl);
                });

                // AISLE FLOOR DOTS
                [-(rowW/2 + 0.5), rowW/2 + 0.5].forEach(dx => {
                    const dot = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.10, 0.10, 0.04, 8),
                        new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0xff9900, emissiveIntensity: 2.8 })
                    );
                    dot.position.set(dx, 0.05, z);
                    scene.add(dot);
                });

                if (isCouple) {
                    for (let i = 0; i < seats.length; i += 2) {
                        const s1 = seats[i], s2 = seats[i+1];
                        const gap = Math.floor(i/6) * 0.28;
                        const px  = startX + i*SEAT_STEP + SEAT_STEP*0.5 + gap;
                        const sel = selectedSeats.has(s1.SeatID)||(s2&&selectedSeats.has(s2.SeatID));
                        const bkd = s1.SeatStatus==='booked'||(s2&&s2.SeatStatus==='booked');
                        const ck  = sel ? 'selected' : bkd ? 'booked' : 'couple';
                        const mat = makeSeatMat(ck);
                        const body = new THREE.Mesh(gCBody, mat.clone());
                        body.position.set(px, y+0.18, z); scene.add(body);
                        const back = new THREE.Mesh(gCBack, mat.clone());
                        back.position.set(px, y+0.56, z+0.26); scene.add(back);
                        const ids = s2 ? [s1.SeatID, s2.SeatID] : [s1.SeatID];
                        ids.forEach(id => { meshMap[id]={body,back}; dataMap[id]=s1; });
                    }
                } else {
                    seats.forEach((seat, ci) => {
                        const half = Math.floor(nSeats/2);
                        const gap  = (ci >= half && nSeats > 4) ? 0.5 : 0;
                        const x    = startX + ci*SEAT_STEP + gap;
                        const ck   = getSeatCK(seat);
                        const mat  = makeSeatMat(ck);

                        const body = new THREE.Mesh(gBody, mat.clone());
                        body.position.set(x, y+0.18, z); scene.add(body);
                        const back = new THREE.Mesh(gBack, mat.clone());
                        back.position.set(x, y+0.56, z+0.26); scene.add(back);

                        if (ck !== 'booked') {
                            [-0.42, 0.42].forEach(ax => {
                                const arm = new THREE.Mesh(gArm,
                                    new THREE.MeshStandardMaterial({
                                        color: new THREE.Color(CLRS[ck][0]).multiplyScalar(0.48),
                                        roughness: 0.7,
                                    }));
                                arm.position.set(x+ax, y+0.32, z+0.06); scene.add(arm);
                            });
                        }
                        meshMap[seat.SeatID] = {body, back};
                        dataMap[seat.SeatID] = seat;
                    });
                }
            });

            // ============================================================
            // COLOR UPDATE API
            // ============================================================
            function applyColor(id) {
                const seat = dataMap[id], m = meshMap[id];
                if (!seat || !m) return;
                const ck  = getSeatCK(seat);
                const col = new THREE.Color(CLRS[ck][0]);
                const emi = new THREE.Color(CLRS[ck][1]);
                const ei  = ck === 'selected' ? 1.0 : 0.28;
                [m.body, m.back].forEach(mesh => {
                    if (!mesh) return;
                    mesh.material.color.copy(col);
                    mesh.material.emissive.copy(emi);
                    mesh.material.emissiveIntensity = ei;
                    mesh.material.needsUpdate = true;
                });
            }

            let animFrameId;
            three3D = {
                updateColors() { Object.keys(meshMap).forEach(id => applyColor(parseInt(id))); },
                destroy()      { cancelAnimationFrame(animFrameId); renderer.dispose(); }
            };

            // ============================================================
            // ORBIT CAMERA — perfectly centered, balanced view
            // ============================================================
            const lastZ   = FIRST_Z + (totalRows - 1) * ROW_STEP;
            // Target: horizontally centered (X=0), vertically mid-scene,
            // depth between screen and mid-row
            const centerZ = (SCREEN_Z + lastZ) * 0.45;
            const TARGET  = new THREE.Vector3(0, 3.5, centerZ);

            // phi=0.62  → ~35° down from horizon (more overhead, balanced view)
            // theta=PI  → camera behind audience looking at screen (straight, no tilt)
            // radius    → auto-fit based on scene depth so whole layout is visible
            const autoRadius = Math.max(24, (lastZ - SCREEN_Z) * 0.88 + 8);
            let sph = { theta: Math.PI, phi: 0.62, radius: autoRadius };

            function updateCam() {
                camera.position.set(
                    TARGET.x + sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta),
                    TARGET.y + sph.radius * Math.cos(sph.phi),
                    TARGET.z + sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta)
                );
                camera.lookAt(TARGET);
            }
            updateCam();

            // Mouse drag
            let drag3D = false, prevM3D = {x:0,y:0};
            renderer.domElement.style.cursor = 'grab';
            renderer.domElement.addEventListener('mousedown', e => {
                drag3D=true; prevM3D={x:e.clientX,y:e.clientY};
                renderer.domElement.style.cursor='grabbing';
            });
            window.addEventListener('mousemove', e => {
                if (!drag3D) return;
                sph.theta -= (e.clientX-prevM3D.x)*0.005;
                sph.phi = Math.max(0.12, Math.min(1.45, sph.phi+(e.clientY-prevM3D.y)*0.005));
                prevM3D = {x:e.clientX,y:e.clientY};
                updateCam();
            });
            window.addEventListener('mouseup', () => { drag3D=false; renderer.domElement.style.cursor='grab'; });

            // Touch drag
            let pt3D=null;
            renderer.domElement.addEventListener('touchstart',e=>{
                if(e.touches.length===1)pt3D={x:e.touches[0].clientX,y:e.touches[0].clientY};
            },{passive:true});
            renderer.domElement.addEventListener('touchmove',e=>{
                if(e.touches.length===1&&pt3D){
                    sph.theta-=(e.touches[0].clientX-pt3D.x)*0.005;
                    sph.phi=Math.max(0.12,Math.min(1.45,sph.phi+(e.touches[0].clientY-pt3D.y)*0.005));
                    pt3D={x:e.touches[0].clientX,y:e.touches[0].clientY};
                    updateCam();
                }
            },{passive:true});
            renderer.domElement.addEventListener('touchend',()=>{pt3D=null;},{passive:true});

            // Scroll zoom
            renderer.domElement.addEventListener('wheel',e=>{
                e.preventDefault();
                sph.radius=Math.max(8, Math.min(80, sph.radius+e.deltaY*0.05));
                updateCam();
            },{passive:false});

            // Resize
            window.addEventListener('resize',()=>{
                if(currentView!=='3d')return;
                const w=container.clientWidth;
                renderer.setSize(w,CH); camera.aspect=w/CH;
                camera.updateProjectionMatrix();
            });

            // ============================================================
            // RENDER LOOP
            // ============================================================
            let t3=0;
            function loop3D(){
                animFrameId=requestAnimationFrame(loop3D);
                t3+=0.012;
                screenGlow.intensity = 4.8+Math.sin(t3)*0.8;
                screenMesh.material.emissiveIntensity = 1.3+Math.sin(t3*1.3)*0.25;
                wallL.intensity = 0.8+Math.sin(t3*0.7)*0.3;
                wallR.intensity = 0.8+Math.sin(t3*0.7+1.0)*0.3;
                renderer.render(scene,camera);
            }
            loop3D();
        }`;

const out = [...lines.slice(0, startLine), newFn, ...lines.slice(endLine+1)].join('\r\n');
fs.writeFileSync(filePath, out, 'utf8');
console.log('Done. Lines:', out.split('\n').length);
