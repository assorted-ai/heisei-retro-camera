/**
 * HEISEI RETRO CAMERA - LOGIC
 * Canvas-based pixelation and dither/color-reduction filtering
 */

document.addEventListener('DOMContentLoaded', () => {
    // === DOM Elements ===
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('display-canvas');
    const ctx = canvas.getContext('2d');
    const placeholder = document.getElementById('placeholder');
    const flashEffect = document.getElementById('flash-effect');
    const clockElement = document.getElementById('status-clock');
    const statusQuality = document.getElementById('status-quality');
    const statusZoom = document.getElementById('status-zoom');
    const statusFlash = document.getElementById('status-flash');
    
    // UI Buttons
    const btnUpload = document.getElementById('btn-upload');
    const btnSave = document.getElementById('btn-save');
    const btnShutter = document.getElementById('btn-shutter');
    const btnPrevFilter = document.getElementById('btn-prev-filter');
    const btnNextFilter = document.getElementById('btn-next-filter');
    const btnDecPixel = document.getElementById('btn-dec-pixel');
    const btnIncPixel = document.getElementById('btn-inc-pixel');
    
    const screenBtnUpload = document.getElementById('screen-btn-upload');
    const screenBtnCamera = document.getElementById('screen-btn-camera');
    
    // Side keys
    const btnSideZoomIn = document.getElementById('btn-side-zoom-in');
    const btnSideZoomOut = document.getElementById('btn-side-zoom-out');
    const btnSideLight = document.getElementById('btn-side-light');
    
    // Sliders & Indicators
    const pixelSlider = document.getElementById('pixel-slider');
    const colorSlider = document.getElementById('color-slider');
    const pixelValueText = document.getElementById('pixel-size-value');
    const colorValueText = document.getElementById('color-level-value');
    const filterNameText = document.getElementById('filter-name');
    const qualityIndicator = document.getElementById('quality-indicator');
    const filterPresetButtons = document.querySelectorAll('.filter-preset-btn');
    
    // Camera Controls
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValueText = document.getElementById('zoom-value');
    const btnToggleCamera = document.getElementById('btn-toggle-camera');
    const btnToggleLight = document.getElementById('btn-toggle-light');

    // Premium & Ads Elements
    const premiumModal = document.getElementById('premium-modal');
    const buyConfirmBtn = document.getElementById('modal-buy-confirm');
    const buyCancelBtn = document.getElementById('modal-buy-cancel');
    const btnBuyPremium = document.getElementById('btn-buy-premium');
    const screenBtnPremium = document.getElementById('screen-btn-premium');
    const premiumStatus = document.getElementById('premium-status');
    const interstitialModal = document.getElementById('ad-interstitial-modal');
    const adCountdownText = document.getElementById('ad-countdown-text');

    // Fullscreen Editor Elements
    const fullscreenEditor = document.getElementById('fullscreen-editor');
    const editorCanvas = document.getElementById('editor-canvas');
    const editorCtx = editorCanvas.getContext('2d');
    const btnExpand = document.getElementById('screen-btn-expand');
    const btnCloseEditor = document.getElementById('editor-close-btn');
    const editorPixelSlider = document.getElementById('editor-pixel-slider');
    const editorColorSlider = document.getElementById('editor-color-slider');
    const editorZoomSlider = document.getElementById('editor-zoom-slider');
    const editorPixelValue = document.getElementById('editor-pixel-size-value');
    const editorColorValue = document.getElementById('editor-color-level-value');
    const editorZoomValue = document.getElementById('editor-zoom-value');
    const editorPresetButtons = document.querySelectorAll('.editor-preset-btn');
    const editorBtnSave = document.getElementById('editor-btn-save');
    const editorBtnQuality = document.getElementById('editor-btn-quality');
    
    // Hidden inputs
    const fileInput = document.getElementById('image-file-input');

    // === App State ===
    let stream = null;
    let loadedImage = null; // アップロードされた画像オブジェクト
    let isCameraActive = false;
    let isFrozen = false; // シャッターを切って静止している状態
    let animationFrameId = null;
    
    // フィルターのパラメータ
    let pixelSize = parseInt(pixelSlider.value, 10);
    let colorLevels = parseInt(colorSlider.value, 10);
    let currentFilterPreset = 'normal'; // normal, mono, gameboy, sepia, cyber
    let saveQuality = 'normal'; // normal (待受/640px), high (高画質/元サイズ)
    
    // カメラ拡張パラメータ
    let cameraFacingMode = 'user'; // user = インカメラ, environment = アウトカメラ
    let zoomLevel = 1.0; // 1.0 〜 3.0
    let isFlashOn = false;

    // 収益化用パラメータ ＆ AdMob 設定
    let saveCount = 0;
    let isPremium = localStorage.getItem('retro_camera_premium') === 'true';

    // Capacitor環境判定
    const isCapacitor = typeof window !== 'undefined' && typeof window.Capacitor !== 'undefined';
    let isAdMobInitialized = false;
    let bannerCreated = false;

    // 全画面編集モード状態フラグ
    let isFullscreenEditorActive = false;

    // AdMob本番用広告ユニットID
    const AD_IDS = {
        android: {
            banner: 'ca-app-pub-6053599520410683/9569739963',
            interstitial: 'ca-app-pub-6053599520410683/1585905799'
        },
        ios: {
            banner: 'ca-app-pub-3940256099942544/2934735716',
            interstitial: 'ca-app-pub-3940256099942544/4411468910'
        }
    };

    function getAdId(type) {
        if (!isCapacitor) return '';
        const platform = window.Capacitor.getPlatform();
        if (platform === 'ios') {
            return AD_IDS.ios[type];
        }
        return AD_IDS.android[type];
    }

    async function initAdMob() {
        if (isCapacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
            const { AdMob } = window.Capacitor.Plugins;
            try {
                await AdMob.initialize({
                    initializeForTesting: false,
                });
                isAdMobInitialized = true;
                console.log('AdMob initialized successfully');
                
                // 無料版の場合は広告バナーを表示
                if (!isPremium) {
                    showNativeBanner();
                }
            } catch (err) {
                console.error('Failed to initialize AdMob:', err);
            }
        } else {
            console.log('Running in browser: using Y2K dummy ads fallback.');
        }
    }

    async function showNativeBanner() {
        if (!isCapacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.AdMob) return;
        const { AdMob } = window.Capacitor.Plugins;
        const bannerId = getAdId('banner');
        if (!bannerId) return;

        try {
            // Webのダミー広告バナーは非表示に
            const dummyBanner = document.getElementById('ad-banner');
            if (dummyBanner) dummyBanner.style.display = 'none';

            // バグ回避のため、常にshowBannerで新規にロードして表示する
            await AdMob.showBanner({
                adId: bannerId,
                adSize: 'BANNER',
                position: 'BOTTOM_CENTER',
                margin: 0,
                isTesting: false
            });
            bannerCreated = true;
            console.log('AdMob Banner shown successfully');
        } catch (err) {
            console.error('Failed to show AdMob Banner:', err);
            // 失敗時はダミー表示へフォールバック
            const dummyBanner = document.getElementById('ad-banner');
            if (dummyBanner && !isPremium) dummyBanner.style.display = 'flex';
        }
    }

    async function hideNativeBanner() {
        if (!isCapacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.AdMob) return;
        const { AdMob } = window.Capacitor.Plugins;
        try {
            // hideBanner / resumeBanner の代わりに removeBanner を使用して確実にインスタンスを削除
            await AdMob.removeBanner();
            bannerCreated = false;
            console.log('AdMob Banner removed');
        } catch (err) {
            console.error('Failed to remove AdMob Banner:', err);
        }
    }

    async function showNativeInterstitial(savedDataURL) {
        if (!isCapacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.AdMob) {
            // Web/通常ブラウザ実行時はダミー全画面広告を出す
            showInterstitialAd(savedDataURL);
            return;
        }

        const { AdMob } = window.Capacitor.Plugins;
        const interstitialId = getAdId('interstitial');
        if (!interstitialId) {
            downloadTrigger(savedDataURL);
            return;
        }

        try {
            await AdMob.prepareInterstitial({
                adId: interstitialId,
                isTesting: false
            });
            
            await AdMob.showInterstitial();
            
            // 広告が閉じられたのを検知してダウンロード実行
            let dismissed = false;
            const dismissListener = AdMob.addListener('interstitialAdDismissed', () => {
                if (!dismissed) {
                    dismissed = true;
                    dismissListener.remove();
                    downloadTrigger(savedDataURL);
                }
            });

            // 念のためのフォールバックタイムアウト(10秒)
            setTimeout(() => {
                if (!dismissed) {
                    dismissed = true;
                    dismissListener.remove();
                    downloadTrigger(savedDataURL);
                }
            }, 10000);

        } catch (err) {
            console.error('Failed to show native Interstitial Ad:', err);
            // エラー時もWebのダミー全画面広告にフォールバック
            showInterstitialAd(savedDataURL);
        }
    }

    
    const filterPresets = ['normal', 'mono', 'gameboy', 'sepia', 'cyber'];
    const filterPresetNames = {
        'normal': '標準ガラケー',
        'mono': '白黒液晶',
        'gameboy': 'レトロ液晶(緑)',
        'sepia': 'セピア画質',
        'cyber': 'Y2Kビビット'
    };

    // === 1. Clock Update ===
    function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        clockElement.textContent = `${hrs}:${mins}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // === 2. Camera Functions ===
    async function startCamera() {
        try {
            // 既存のストリームがあれば停止
            stopAllSources();

            stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: cameraFacingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }, 
                audio: false 
            });
            video.srcObject = stream;
            
            // ビデオ読み込み完了後に描画開始
            video.onloadedmetadata = () => {
                video.play();
                isCameraActive = true;
                isFrozen = false;
                loadedImage = null;
                placeholder.style.display = 'none';
                
                // キャンバスサイズをビデオの比率に合わせつつ、ガラケー液晶サイズに固定
                adjustCanvasSize(video.videoWidth, video.videoHeight);
                
                // 実機へのズーム・ライト制約の初期適用
                applyTrackConstraints();
                
                // ループ開始
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                renderLoop();
            };
        } catch (err) {
            console.error('Camera initialization failed:', err);
            alert('カメラの起動に失敗しました。カメラの権限を許可するか、手持ちの画像をアップロードして楽しんでね！');
        }
    }

    function stopAllSources() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        video.srcObject = null;
        isCameraActive = false;
        loadedImage = null;
    }

    function adjustCanvasSize(originalWidth, originalHeight) {
        // VGA解像度（640px幅）を基準とする。表示はCSSで縮小されて液晶画面にフィットする
        const displayWidth = 640;
        // 比率を維持
        const ratio = originalHeight / originalWidth;
        const displayHeight = displayWidth * ratio;
        
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }

    // === 3. Image Processing Core (The retro filter logic) ===
    function applyRetroFilters(source) {
        renderRetroEffects(canvas, source, pixelSize, colorLevels, currentFilterPreset);
    }

    // 汎用フィルター適用関数（メインプレビューと高解像度保存の両方で使用）
    function renderRetroEffects(targetCanvas, source, pSize, cLevels, preset) {
        if (targetCanvas.width === 0 || targetCanvas.height === 0) return;
        const targetCtx = targetCanvas.getContext('2d');
        const w = targetCanvas.width;
        const h = targetCanvas.height;

        // 1. ドット絵化（低解像度化）の処理：
        if (pSize > 1) {
            const offCanvas = document.createElement('canvas');
            const offCtx = offCanvas.getContext('2d');
            
            const sw = Math.max(4, Math.floor(w / pSize));
            const sh = Math.max(4, Math.floor(h / pSize));
            
            offCanvas.width = sw;
            offCanvas.height = sh;
            
            // --- デジタルズーム対応 ---
            let srcW = source.videoWidth || source.width || w;
            let srcH = source.videoHeight || source.height || h;
            
            let wCrop = srcW / zoomLevel;
            let hCrop = srcH / zoomLevel;
            let sx = (srcW - wCrop) / 2;
            let sy = (srcH - hCrop) / 2;
            
            offCtx.drawImage(source, sx, sy, wCrop, hCrop, 0, 0, sw, sh);
            
            targetCtx.imageSmoothingEnabled = false;
            targetCtx.mozImageSmoothingEnabled = false;
            targetCtx.webkitImageSmoothingEnabled = false;
            targetCtx.msImageSmoothingEnabled = false;
            
            targetCtx.drawImage(offCanvas, 0, 0, sw, sh, 0, 0, w, h);
        } else {
            // ズーム対応（ドット化なし）
            let srcW = source.videoWidth || source.width || w;
            let srcH = source.videoHeight || source.height || h;
            
            let wCrop = srcW / zoomLevel;
            let hCrop = srcH / zoomLevel;
            let sx = (srcW - wCrop) / 2;
            let sy = (srcH - hCrop) / 2;
            
            targetCtx.drawImage(source, sx, sy, wCrop, hCrop, 0, 0, w, h);
        }

        // 2. 減色処理 ＆ カラープリセットの適用
        const imgData = targetCtx.getImageData(0, 0, w, h);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i+1];
            let b = data[i+2];

            if (preset === 'mono') {
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                r = g = b = gray;
            } else if (preset === 'gameboy') {
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                if (gray < 64) {
                    r = 15; g = 56; b = 15;
                } else if (gray < 128) {
                    r = 48; g = 98; b = 48;
                } else if (gray < 192) {
                    r = 139; g = 172; b = 15;
                } else {
                    r = 155; g = 188; b = 15;
                }
            } else if (preset === 'sepia') {
                const tr = 0.393 * r + 0.769 * g + 0.189 * b;
                const tg = 0.349 * r + 0.686 * g + 0.168 * b;
                const tb = 0.272 * r + 0.534 * g + 0.131 * b;
                r = Math.min(255, tr);
                g = Math.min(255, tg);
                b = Math.min(255, tb);
            } else if (preset === 'cyber') {
                r = r > 127 ? Math.min(255, r * 1.3) : Math.max(0, r * 0.7);
                g = g > 127 ? Math.min(255, g * 1.3) : Math.max(0, g * 0.7);
                b = b > 127 ? Math.min(255, b * 1.5) : Math.max(0, b * 0.5);
                r = (r + 30) > 255 ? 255 : r + 30;
                b = (b + 50) > 255 ? 255 : b + 50;
            }

            if (preset !== 'gameboy') {
                r = Math.round(r / 255 * (cLevels - 1)) * (255 / (cLevels - 1));
                g = Math.round(g / 255 * (cLevels - 1)) * (255 / (cLevels - 1));
                b = Math.round(b / 255 * (cLevels - 1)) * (255 / (cLevels - 1));
            }

            data[i] = r;
            data[i+1] = g;
            data[i+2] = b;
        }

        targetCtx.putImageData(imgData, 0, 0);
    }

    // === 4. Render Loop ===
    function renderLoop() {
        if (isCameraActive && !isFrozen) {
            if (isFullscreenEditorActive) {
                adjustEditorCanvasSize(video.videoWidth, video.videoHeight);
                editorCtx.drawImage(video, 0, 0, editorCanvas.width, editorCanvas.height);
                renderRetroEffects(editorCanvas, video, pixelSize, colorLevels, currentFilterPreset);
            } else {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                applyRetroFilters(canvas);
            }
            animationFrameId = requestAnimationFrame(renderLoop);
        } else if (loadedImage) {
            if (isFullscreenEditorActive) {
                adjustEditorCanvasSize(loadedImage.width, loadedImage.height);
                editorCtx.drawImage(loadedImage, 0, 0, editorCanvas.width, editorCanvas.height);
                renderRetroEffects(editorCanvas, loadedImage, pixelSize, colorLevels, currentFilterPreset);
            } else {
                ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
                applyRetroFilters(canvas);
            }
        }
    }

    function adjustEditorCanvasSize(originalWidth, originalHeight) {
        const displayWidth = 800;
        const ratio = originalHeight / originalWidth;
        const displayHeight = displayWidth * ratio;
        if (editorCanvas.width !== displayWidth || editorCanvas.height !== displayHeight) {
            editorCanvas.width = displayWidth;
            editorCanvas.height = displayHeight;
        }
    }

    // === 5. Image Upload Handling ===
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // カメラストリームを停止
                stopAllSources();
                
                loadedImage = img;
                isFrozen = false;
                placeholder.style.display = 'none';
                
                // 画像の比率に合わせてキャンバスサイズを設定
                adjustCanvasSize(img.width, img.height);
                
                // 描画
                renderLoop();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // === 6. App Actions & UI Trigger Interactions ===

    // シャッター機能（撮影＆固定）
    function triggerShutter() {
        if (!isCameraActive && !loadedImage) {
            // 初期状態ならカメラを起動する
            startCamera();
            return;
        }

        if (isCameraActive && !isFrozen) {
            // カメラ動作中なら、現在のフレームで固定（撮影）
            isFrozen = true;
            
            // シャッター音（未実装だが画面フラッシュで表現）
            flashEffect.classList.add('flash-active');
            setTimeout(() => {
                flashEffect.classList.remove('flash-active');
            }, 400);

            // 操作ガイドの表示変更
            document.getElementById('guide-center').textContent = '再撮影';
        } else if (isCameraActive && isFrozen) {
            // 固定中ならプレビューを再開
            isFrozen = false;
            document.getElementById('guide-center').textContent = '撮影/変換';
            renderLoop();
        }
    }

    // 保存画質の切り替え（待ち受け / 高画質）
    function toggleSaveQuality() {
        if (saveQuality === 'normal') {
            saveQuality = 'high';
            statusQuality.textContent = '[高画質]';
            qualityIndicator.textContent = '保存画質: 高画質 (写真の元サイズ)';
        } else {
            saveQuality = 'normal';
            statusQuality.textContent = '[待受]';
            qualityIndicator.textContent = '保存画質: 待ち受けサイズ (640px)';
        }
        updateEditorQualityButton();
    }

    function updateEditorQualityButton() {
        if (!editorBtnQuality) return;
        if (saveQuality === 'high') {
            editorBtnQuality.textContent = '📷 画質: 高画質 (元ｻｲｽﾞ)';
            editorBtnQuality.style.color = '#ffd54f';
            editorBtnQuality.style.borderColor = '#ffd54f';
        } else {
            editorBtnQuality.textContent = '📷 画質: 待受ｻｲｽﾞ (640px)';
            editorBtnQuality.style.color = '#00ffff';
            editorBtnQuality.style.borderColor = '#475569';
        }
    }

    // 保存機能
    function saveImage() {
        if (placeholder.style.display !== 'none') {
            alert('保存する画像がありません。カメラを起動するか、画像を読み込んでね！');
            return;
        }

        let savedDataURL = '';

        if (saveQuality === 'normal') {
            // 待ち受けサイズ (640px)
            savedDataURL = canvas.toDataURL('image/jpeg');
        } else {
            // 高画質（元サイズ）
            let origW = 640;
            let origH = 480;
            let sourceEl = null;

            if (loadedImage) {
                origW = loadedImage.width;
                origH = loadedImage.height;
                sourceEl = loadedImage;
            } else if (isCameraActive) {
                origW = video.videoWidth || 640;
                origH = video.videoHeight || 480;
                sourceEl = video;
            }

            if (!sourceEl) {
                savedDataURL = canvas.toDataURL('image/jpeg');
            } else {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = origW;
                tempCanvas.height = origH;

                // プレビュー表示解像度は640px幅がベース
                const relativePixelSize = Math.max(1, Math.round(origW * (pixelSize / 640)));

                renderRetroEffects(tempCanvas, sourceEl, relativePixelSize, colorLevels, currentFilterPreset);
                savedDataURL = tempCanvas.toDataURL('image/jpeg');
            }
        }

        // --- 広告制御ロジックのフック ---
        if (isPremium) {
            // プレミアム購入済なら即座に保存
            downloadTrigger(savedDataURL);
        } else {
            saveCount++;
            if (saveCount % 3 === 0) {
                // 3回保存するごとに全画面インタースティシャル広告（本物、環境に応じてダミーへフォールバック）を表示
                showNativeInterstitial(savedDataURL);
            } else {
                downloadTrigger(savedDataURL);
            }
        }
    }

    function downloadTrigger(dataURL) {
        const link = document.createElement('a');
        const now = new Date();
        const dateStr = now.getFullYear().toString().substring(2) + 
                        String(now.getMonth()+1).padStart(2, '0') + 
                        String(now.getDate()).padStart(2, '0');
        const timeStr = String(now.getHours()).padStart(2, '0') + 
                        String(now.getMinutes()).padStart(2, '0') + 
                        String(now.getSeconds()).padStart(2, '0');
        
        const prefix = saveQuality === 'high' ? 'HD' : 'ME';
        link.download = `${prefix}_${dateStr}_${timeStr}.jpg`;
        link.href = dataURL;
        link.click();

        // Web版限定: 保存成功後にPWAインストール促進トーストを表示
        showPwaToast();
    }

    // フィルターの切り替え処理
    function changeFilter(direction) {
        let index = filterPresets.indexOf(currentFilterPreset);
        if (direction === 'next') {
            index = (index + 1) % filterPresets.length;
        } else {
            index = (index - 1 + filterPresets.length) % filterPresets.length;
        }
        setFilterPreset(filterPresets[index]);
    }

    function setFilterPreset(presetName) {
        currentFilterPreset = presetName;
        
        // アクティブなボタン表示の変更
        filterPresetButtons.forEach(btn => {
            if (btn.getAttribute('data-preset') === presetName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 全画面編集モードのボタン表示も同期
        updateEditorPresetsHighlight();

        // 状態パネルの更新
        filterNameText.textContent = `フィルター: ${filterPresetNames[presetName]}`;

        // プリセットごとの適正値をセット
        if (presetName === 'gameboy') {
            // ゲームボーイは色数を4固定にするため、スライダーを無効っぽく見せる
            colorSlider.disabled = true;
            colorValueText.textContent = '4 (固定)';
        } else {
            colorSlider.disabled = false;
            colorValueText.textContent = colorLevels;
        }

        // 再レンダリング
        if (!isCameraActive || isFrozen || loadedImage) {
            renderLoop();
        }
    }

    // === 全画面編集モードの制御 ＆ 双方向同期 ===
    function toggleFullscreenEditor() {
        isFullscreenEditorActive = !isFullscreenEditorActive;
        const webOnlyContainer = document.querySelector('.web-only-container');

        if (isFullscreenEditorActive) {
            fullscreenEditor.classList.add('active');
            
            // Web用広告・アコーディオンを非表示にする
            if (webOnlyContainer) {
                webOnlyContainer.style.display = 'none';
            }
            
            // 各種スライダーの値を同期
            editorPixelSlider.value = pixelSize;
            editorPixelValue.textContent = pixelSize;
            editorColorSlider.value = colorLevels;
            editorColorValue.textContent = colorLevels;
            editorZoomSlider.value = zoomLevel;
            editorZoomValue.textContent = zoomLevel.toFixed(1);
            
            updateEditorPresetsHighlight();
            updateEditorQualityButton();
            
            // 全画面モード中はネイティブバナー広告を非表示にしてボタン被りを防ぐ
            hideNativeBanner();
            
            // カメラ非起動時はズームスライダーを無効化
            const editorZoomGroup = document.getElementById('editor-zoom-group');
            if (editorZoomGroup) {
                if (!isCameraActive) {
                    editorZoomGroup.style.opacity = '0.5';
                    editorZoomSlider.disabled = true;
                } else {
                    editorZoomGroup.style.opacity = '1.0';
                    editorZoomSlider.disabled = false;
                }
            }
            
            // 静止画像・撮影済みの場合は即時描画
            if (!isCameraActive || isFrozen || loadedImage) {
                renderLoop();
            }
        } else {
            fullscreenEditor.classList.remove('active');
            
            // Web用広告・アコーディオンを再表示する
            if (webOnlyContainer) {
                webOnlyContainer.style.display = 'block';
            }
            
            // 通常画面に戻る際はバナー広告を再表示する（プレミアム版でなければ）
            if (!isPremium) {
                showNativeBanner();
            }
            
            // メイン画面の液晶キャンバスを再描画
            if (!isCameraActive || isFrozen || loadedImage) {
                renderLoop();
            }
        }
    }

    function updateEditorPresetsHighlight() {
        if (!editorPresetButtons) return;
        editorPresetButtons.forEach(btn => {
            if (btn.getAttribute('data-preset') === currentFilterPreset) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // 表示モード（全画面/全体表示）の切り替え
    function toggleDisplayMode() {
        if (canvas.classList.contains('fit-contain')) {
            canvas.classList.remove('fit-contain');
        } else {
            canvas.classList.add('fit-contain');
        }
        // 静止画状態の時は再描画
        if (!isCameraActive || isFrozen || loadedImage) {
            renderLoop();
        }
    }

    // ピクセルサイズ（ドット粗さ）の変更
    function adjustPixelSize(delta) {
        let currentVal = parseInt(pixelSlider.value, 10);
        let newVal = currentVal + delta;
        newVal = Math.max(parseInt(pixelSlider.min, 10), Math.min(parseInt(pixelSlider.max, 10), newVal));
        
        pixelSlider.value = newVal;
        pixelSize = newVal;
        pixelValueText.textContent = newVal;
        
        if (!isCameraActive || isFrozen || loadedImage) {
            renderLoop();
        }
    }

    // イン/アウトカメラ切り替え
    function toggleCamera() {
        if (!isCameraActive) {
            alert('カメラが起動していません。液晶の「ｶﾒﾗ起動」を押してね！');
            return;
        }
        cameraFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
        startCamera();
    }

    // ズーム倍率調整
    function adjustZoom(delta) {
        zoomLevel += delta;
        zoomLevel = Math.max(1.0, Math.min(3.0, zoomLevel));
        zoomLevel = Math.round(zoomLevel * 10) / 10;
        
        zoomSlider.value = zoomLevel;
        zoomValueText.textContent = zoomLevel.toFixed(1);
        statusZoom.textContent = `[x${zoomLevel.toFixed(1)}]`;
        
        applyTrackConstraints();
        
        if (!isCameraActive || isFrozen || loadedImage) {
            renderLoop();
        }
    }

    // プレミアム機能（広告非表示）の初期チェックと適用
    function initPremiumState() {
        if (isPremium) {
            document.body.classList.add('premium-active');
            premiumStatus.textContent = 'ステータス: プレミアム版 (広告なし)';
            premiumStatus.style.backgroundColor = '#1b351e';
            premiumStatus.style.color = '#81c784';
            premiumStatus.style.borderColor = '#0c1a0e';
            btnBuyPremium.textContent = '適用済み (広告非表示)';
            
            // 本物バナーが動いていれば非表示にする
            hideNativeBanner();
        } else {
            document.body.classList.remove('premium-active');
            premiumStatus.textContent = 'ステータス: 無料版 (広告あり)';
            premiumStatus.style.backgroundColor = '#3b2a2a';
            premiumStatus.style.color = '#ef5350';
            premiumStatus.style.borderColor = '#2b1010';
            btnBuyPremium.textContent = '💎 広告を消す (￥300)';
            
            // 本物バナーが初期化されていれば表示する
            if (isAdMobInitialized) {
                showNativeBanner();
            }
        }
    }

    function openPremiumModal() {
        if (isPremium) {
            alert('すでにプレミアム版を購入済みです！');
            return;
        }
        premiumModal.classList.add('active');
    }

    function closePremiumModal() {
        premiumModal.classList.remove('active');
    }

    function buyPremium() {
        isPremium = true;
        localStorage.setItem('retro_camera_premium', 'true');
        initPremiumState();
        closePremiumModal();
        alert('プレミアム版をご購入いただきありがとうございます！アプリ内のバナー広告が非表示になり、保存時のポップアップ広告も発生しなくなりました。');
    }

    // 全画面インタースティシャル広告の表示
    function showInterstitialAd(savedDataURL) {
        interstitialModal.classList.add('active');
        let timeLeft = 3;
        adCountdownText.textContent = `広告を読み込んでいます… (あと ${timeLeft} 秒)`;

        const countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                interstitialModal.classList.remove('active');
                // カウントダウン終了後に写真保存
                downloadTrigger(savedDataURL);
            } else {
                adCountdownText.textContent = `広告を読み込んでいます… (あと ${timeLeft} 秒)`;
            }
        }, 1000);
    }

    // フラッシュ（ライト）トグル
    async function toggleFlash() {
        isFlashOn = !isFlashOn;
        statusFlash.textContent = isFlashOn ? '⚡[点灯]' : '⚡[切]';
        btnToggleLight.classList.toggle('active', isFlashOn);
        
        applyTrackConstraints();
    }

    // 実機のズームとトーチライトを制御
    async function applyTrackConstraints() {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        if (!track) return;
        
        try {
            const capabilities = track.getCapabilities();
            const constraints = {};
            
            // 1. フラッシュライト
            if (capabilities.torch) {
                constraints.torch = isFlashOn;
            }
            
            // 2. 実機ズーム
            if (capabilities.zoom) {
                const minZoom = capabilities.zoom.min || 1.0;
                const maxZoom = capabilities.zoom.max || 3.0;
                // zoomLevel (1.0~3.0) をデバイスのズーム範囲にマッピング
                const targetZoom = minZoom + (zoomLevel - 1.0) * (maxZoom - minZoom) / 2.0;
                constraints.zoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
            }
            
            if (Object.keys(constraints).length > 0) {
                await track.applyConstraints({ advanced: [constraints] });
            }
        } catch (err) {
            console.log("Device constraints not fully supported in this browser:", err);
        }
    }

    // === 7. Event Listeners ===

    // スライダー操作
    pixelSlider.addEventListener('input', (e) => {
        pixelSize = parseInt(e.target.value, 10);
        pixelValueText.textContent = pixelSize;
        if (!isCameraActive || isFrozen || loadedImage) renderLoop();
    });

    colorSlider.addEventListener('input', (e) => {
        colorLevels = parseInt(e.target.value, 10);
        colorValueText.textContent = colorLevels;
        if (!isCameraActive || isFrozen || loadedImage) renderLoop();
    });

    // 液晶内の「カメラ起動」「画像選択」
    screenBtnCamera.addEventListener('click', startCamera);
    screenBtnUpload.addEventListener('click', () => fileInput.click());

    // ガラケー本体の物理キー操作
    // 左ソフトキー(btnUpload)は「画像選択」から「カメラ切り替え」に機能をアップグレード
    btnUpload.addEventListener('click', toggleCamera);
    btnSave.addEventListener('click', saveImage);
    btnShutter.addEventListener('click', triggerShutter);
    
    // 十字キー
    btnPrevFilter.addEventListener('click', () => changeFilter('prev'));
    btnNextFilter.addEventListener('click', () => changeFilter('next'));
    btnDecPixel.addEventListener('click', () => adjustPixelSize(-1));
    btnIncPixel.addEventListener('click', () => adjustPixelSize(1));

    // サイドキー操作（ズーム・ライト）
    btnSideZoomIn.addEventListener('click', () => adjustZoom(0.2));
    btnSideZoomOut.addEventListener('click', () => adjustZoom(-0.2));
    btnSideLight.addEventListener('click', toggleFlash);

    // コントロールパネル操作（ズーム・切り替えボタン）
    zoomSlider.addEventListener('input', (e) => {
        zoomLevel = parseFloat(e.target.value);
        zoomValueText.textContent = zoomLevel.toFixed(1);
        statusZoom.textContent = `[x${zoomLevel.toFixed(1)}]`;
        applyTrackConstraints();
        if (!isCameraActive || isFrozen || loadedImage) renderLoop();
    });
    btnToggleCamera.addEventListener('click', toggleCamera);
    btnToggleLight.addEventListener('click', toggleFlash);

    // テンキーのアクション（お遊び要素・ショートカット）
    const numKeys = document.querySelectorAll('.num-btn');
    numKeys.forEach(btn => {
        btn.addEventListener('click', () => {
            const keyVal = btn.getAttribute('data-key');
            
            // キーパッドを押したときの微小なバンプ音の代わりにバックライトをアニメーション
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 150);

            // 特殊キー機能
            if (keyVal === '#') {
                // リセット
                stopAllSources();
                placeholder.style.display = 'flex';
                // Canvasをクリア
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                document.getElementById('guide-center').textContent = '撮影/変換';
                
                // 【デバッグ用】もしプレミアム版なら、無料版に戻して確認しやすくする
                if (isPremium) {
                    isPremium = false;
                    localStorage.removeItem('retro_camera_premium');
                    initPremiumState();
                    alert('【デバッグ機能】プレミアム版の購入状態をリセットしました（広告が再度表示されます）。');
                }
            } else if (keyVal === '*') {
                // 保存画質の切り替え（待ち受け / 高画質）
                toggleSaveQuality();
            } else if (keyVal === '0') {
                // 画面表示モード切り替え（全画面/全体表示）
                toggleDisplayMode();
            } else if (keyVal === '7') {
                // テンキー「7」キーで画像フォルダを開く（お遊び用バインド）
                fileInput.click();
            } else if (keyVal === '9') {
                // テンキー「9」キーで全画面編集モード起動/トグル
                toggleFullscreenEditor();
            } else if (['1','2','3','4','5'].includes(keyVal)) {
                // 1~5キーでフィルター直接指定
                const presets = ['normal', 'mono', 'gameboy', 'sepia', 'cyber'];
                setFilterPreset(presets[parseInt(keyVal, 10) - 1]);
            }
        });
    });

    // フィルタープリセットボタン
    filterPresetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setFilterPreset(btn.getAttribute('data-preset'));
        });
    });

    // 全画面編集モードのイベントバインド
    btnExpand.addEventListener('click', toggleFullscreenEditor);
    btnCloseEditor.addEventListener('click', toggleFullscreenEditor);

    editorPixelSlider.addEventListener('input', (e) => {
        pixelSize = parseInt(e.target.value, 10);
        editorPixelValue.textContent = pixelSize;
        // メイン側スライダーと値を同期
        pixelSlider.value = pixelSize;
        pixelValueText.textContent = pixelSize;
        if (!isCameraActive || isFrozen || loadedImage) renderLoop();
    });

    editorColorSlider.addEventListener('input', (e) => {
        colorLevels = parseInt(e.target.value, 10);
        editorColorValue.textContent = colorLevels;
        // メイン側スライダーと同期
        colorSlider.value = colorLevels;
        colorValueText.textContent = colorLevels;
        if (!isCameraActive || isFrozen || loadedImage) renderLoop();
    });

    editorZoomSlider.addEventListener('input', (e) => {
        zoomLevel = parseFloat(e.target.value);
        editorZoomValue.textContent = zoomLevel.toFixed(1);
        // メイン側スライダーと同期
        zoomSlider.value = zoomLevel;
        zoomValueText.textContent = zoomLevel.toFixed(1);
        statusZoom.textContent = `[x${zoomLevel.toFixed(1)}]`;
        applyTrackConstraints();
        if (!isCameraActive || isFrozen || loadedImage) renderLoop();
    });

    editorPresetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            setFilterPreset(preset);
            updateEditorPresetsHighlight();
        });
    });

    editorBtnSave.addEventListener('click', saveImage);
    editorBtnQuality.addEventListener('click', toggleSaveQuality);

    // プレミアム購入関連 of イベントバインド
    btnBuyPremium.addEventListener('click', openPremiumModal);
    screenBtnPremium.addEventListener('click', openPremiumModal);
    buyConfirmBtn.addEventListener('click', buyPremium);
    buyCancelBtn.addEventListener('click', closePremiumModal);

    // アプリ起動時のプレミアム状態チェックとAdMobの初期化
    initPremiumState();
    initAdMob();
    updateEditorQualityButton();

    // PCのキーボード操作（ショートカット）イベントバインド
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const key = e.key;
        if (key >= '1' && key <= '5') {
            const presets = ['normal', 'mono', 'gameboy', 'sepia', 'cyber'];
            setFilterPreset(presets[parseInt(key, 10) - 1]);
        } else if (key === '7') {
            fileInput.click();
        } else if (key === '9') {
            toggleFullscreenEditor();
        } else if (key === '0') {
            toggleDisplayMode();
        } else if (key === '*') {
            toggleSaveQuality();
        } else if (key === '#') {
            // リセット処理
            stopAllSources();
            placeholder.style.display = 'flex';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            document.getElementById('guide-center').textContent = '撮影/変換';
            if (isPremium) {
                isPremium = false;
                localStorage.removeItem('retro_camera_premium');
                initPremiumState();
                alert('【デバッグ機能】プレミアム版の購入状態をリセットしました（広告が再度表示されます）。');
            }
        }
    });

    // ファイルアップローダー
    fileInput.addEventListener('change', handleImageUpload);

    // === 8. Web PWA & Accordion Control ===

    // Capacitor環境時にbodyクラスを追加（Web限定コンテンツの非表示用）
    if (isCapacitor) {
        document.body.classList.add('is-capacitor');
    }

    // アコーディオン（紹介・使い方パネル）開閉
    const accordionBtn = document.getElementById('accordion-toggle-btn');
    const accordionContent = document.getElementById('accordion-content-panel');
    const accordionParent = document.querySelector('.intro-accordion');

    if (accordionBtn && accordionContent) {
        accordionBtn.addEventListener('click', () => {
            const isOpen = accordionParent.classList.toggle('open');
            if (isOpen) {
                accordionContent.style.maxHeight = accordionContent.scrollHeight + "px";
            } else {
                accordionContent.style.maxHeight = "0px";
            }
        });
    }

    // PWAインストール案内トースト制御
    const pwaToast = document.getElementById('pwa-toast');
    const pwaToastCloseBtn = document.getElementById('pwa-toast-close-btn');

    if (pwaToastCloseBtn) {
        pwaToastCloseBtn.addEventListener('click', () => {
            if (pwaToast) {
                pwaToast.classList.remove('show');
                // 一度閉じたらセッション中は再表示しない
                sessionStorage.setItem('pwa_toast_dismissed', 'true');
            }
        });
    }

    function showPwaToast() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isDismissed = sessionStorage.getItem('pwa_toast_dismissed') === 'true';

        // アプリ版、すでにPWA、または閉じ済みの場合は何もしない
        if (isCapacitor || isStandalone || isDismissed) {
            return;
        }

        setTimeout(() => {
            if (pwaToast) {
                pwaToast.style.display = 'block';
                // リフロー強制
                pwaToast.offsetHeight;
                pwaToast.classList.add('show');
            }
        }, 1500);
    }
});
