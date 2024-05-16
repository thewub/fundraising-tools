(function() {

    /**
     * Lock selection to one side at a time
     * From resources/src/mediawiki.diff.styles/diff.js
     */
    $( function setDiffSideProtection() {
        /**
         * @param {Node} node
         * @return {string|undefined}
         * @ignore
         */
        function getNodeSide( node ) {
            if ( $( node ).closest( '.diff-side-deleted' ).length !== 0 ) {
                return 'deleted';
            } else if ( $( node ).closest( '.diff-side-added' ).length !== 0 ) {
                return 'added';
            } else {
                // Not inside the diff.
                return undefined;
            }
        }

        /**
         * @return {string|undefined}
         * @ignore
         */
        function getCurrentlyLockedSide() {
            return $( '.diff' ).attr( 'data-selected-side' );
        }

        /**
         * @param {string|undefined} side Either "added" or "deleted", or undefined to unset.
         * @ignore
         */
        function setSideLock( side ) {
            $( '.diff' ).attr( 'data-selected-side', side );
        }

        /**
         * @param {MouseEvent} e
         * @ignore
         */
        function maybeClearSelectProtection( e ) {
            if ( e.button === 2 ) {
                // Right click.
                return;
            }
            var clickSide = getNodeSide( e.target );
            if ( getCurrentlyLockedSide() !== clickSide ) {
                document.getSelection().removeAllRanges();
            }
            setSideLock( clickSide );
        }

        function selectionHandler() {
            var textNode = document.getSelection().anchorNode;

            if ( !textNode ) {
                return;
            }

            setSideLock( getNodeSide( textNode ) );
        }

        $( document ).on( 'selectionchange', selectionHandler );
        $( document ).on( 'mousedown', maybeClearSelectProtection );
    } );


    /**
     * This gets a lot of info (more than we need), but breaks for less standard names
     * But keep it around as it might be useful starting point for future projects
     * @param  {string} bannerName
     * @return {object}
     */
    function parseBannerName( bannerName ) {
        let trimmedName = bannerName.match(/B\d\d\d\d.*/)[0]; // remove user name from start
        let x = trimmedName.split('_');
        let bannerData = {
            fiscal: 'FY' + x[0].substring(1,3) + '–' + x[0].substring(3,5),
            mmdd: x[1].substring(0,4),
            language: x[2].substring(0,2),
            country: x[2].substring(2,4),
            device: x[3],
            size: x[5],
            testType: x[6],
            testVariant: x[7]
        }
        if ( bannerName.includes('_m_') ) {
            bannerData.device = 'm';
        }
        return bannerData;
    }

    /**
     * Regex-based name parser. Gives less info but hopefully more reliable
     * @param  {string} bannerName
     * @return {object}
     */
    function newParseBannerName( bannerName ) {
        let bannerData = {};
        try {
            let langCountry = bannerName.match( /_([a-z]{2,})([0-9A-Z]{2,})_/ );
            if ( langCountry ) {
                bannerData.language = langCountry[1];
                bannerData.country = langCountry[2];
            }
            if ( bannerName.match( /_m_|_mob_|_ipd_/ ) ) {
                bannerData.device = 'm';
            } else {
                bannerData.device = 'dsk';
            }
        } catch(e) {
            console.warn('Error parsing banner name, using default values')
            bannerData.language = 'en';
            bannerData.country = 'GB';
            bannerData.device = 'dsk';
        }
        return bannerData;
    }

    function editUrl( bannerName ) {
        return 'https://meta.wikimedia.org/wiki/Special:CentralNoticeBanners/Edit/' + bannerName;
    }

    // TODO: split this out into a module
    function previewUrl( bannerName, options = {} ) {
        var url;

        // Norwegian is weird, language code is nb but wiki is at no.wikipedia.org
        if ( options.language === 'nb' ) {
            options.language = 'no';
        }

        if ( options.device === 'm' ) {
            url = `https://${options.language}.m.wikipedia.org/wiki/${options.article}?country=${options.country}&banner=${bannerName}`;
        } else {
            url = `https://${options.language}.wikipedia.org/wiki/${options.article}?country=${options.country}&banner=${bannerName}`;
        }

        if ( options.forceApplePay ) {
            url += '&forceApplePay=1';
        }
        if ( options.nightMode ) {
            if ( options.device === 'm' ) {
                url += '&minervanightmode=1';
            } else {
                url += '&vectornightmode=1';
            }
        }

        return url;
    }

    var bodyClasses = document.body.classList,
        diffElement = document.getElementById('diff-element'),
        statusElement = document.getElementById('status'),
        urlParams = new URLSearchParams(window.location.search),
        banner1 = urlParams.get('banner1'),
        banner2 = urlParams.get('banner2'),
        editLink = 'https://meta.wikimedia.org/wiki/Special:CentralNoticeBanners/Edit/',
        apiEndpoint = 'https://meta.wikimedia.org/w/api.php',
        params = 'origin=*&action=compare&format=json&prop=diff|size',
        bannerPagePrefix = 'MediaWiki:Centralnotice-template-',
        previewOptions,
        languageSelect = document.getElementById('language-select'),
        countrySelect = document.getElementById('country-select'),
        previewSizeSelect = document.getElementById('preview-size-select'),
        diffContent, fromSize, toSize, sizeChange;

    params += '&fromtitle=' + bannerPagePrefix + banner1;
    params += '&totitle=' + bannerPagePrefix + banner2;

    document.getElementById( 'title-banner1' ).innerText = banner1;
    document.getElementById( 'title-banner2' ).innerText = banner2;

    document.getElementById( 'edit-banner1' ).setAttribute( 'href', editUrl( banner1 ) );
    document.getElementById( 'edit-banner2' ).setAttribute( 'href', editUrl( banner2 ) );

    // Get initial preview options
    previewOptions = newParseBannerName( banner1 );
    if ( previewOptions.language === 'ml' ) {
        previewOptions.language = 'en';
    }
    if ( previewOptions.country === '6C' || previewOptions.country === 'WW' ) {
        previewOptions.country = 'GB'
    } else if ( previewOptions.country === 'LA' ) {
        previewOptions.country = 'AR';
    }
    previewOptions.article = 'NASA';

    languageSelect.value = previewOptions.language;
    languageSelect.addEventListener( 'change', (e) => {
        previewOptions.language = languageSelect.value;
        updatePreviewUrls();
    });
    
    countrySelect.value = previewOptions.country;
    countrySelect.addEventListener( 'change', (e) => {
        previewOptions.country = countrySelect.value;
        updatePreviewUrls();
    });

    document.getElementById( 'force-apple-pay' ).addEventListener( 'change', (e) => {
        previewOptions.forceApplePay = e.target.checked;
        updatePreviewUrls();
    });

    document.getElementById( 'preview-night-mode' ).addEventListener( 'change', (e) => {
        previewOptions.nightMode = e.target.checked;
        updatePreviewUrls();
    });

    updatePreviewUrls();

    if ( banner1 === banner2 ) {
        statusElement.innerHTML = 'Those are the same banner!';
        return;
    }

    fetch( apiEndpoint + '?' + params )
        .then(function(response) { return response.json(); } )
        .then(function(response) {
            try {
                diffContent = response.compare['*'];
                if ( diffContent.match(/<tr>/) ) {
                    diffElement.innerHTML = diffContent;
                    statusElement.remove();
                } else {
                    statusElement.innerHTML = 'No difference between banners.';
                }
                fromSize   = response.compare.fromsize;
                toSize     = response.compare.tosize;
                sizeChange = toSize - fromSize;
                document.getElementById('size-banner1').innerText = fromSize.toLocaleString() + ' bytes';
                document.getElementById('size-banner2').innerText = toSize.toLocaleString() + ' bytes';
                document.getElementById('size-change').innerText =
                    sizeChange.toLocaleString( undefined, { signDisplay: 'always' } );
            } catch(e) {
                statusElement.innerHTML = 'Error getting diff. Do both banners exist?';
            }
        });
    
    document.getElementById( 'enable-live-preview' ).addEventListener( 'click', () => {
        enableLivePreview();
    });

    document.getElementById( 'disable-live-preview' ).addEventListener( 'click', () => {
        bodyClasses.remove( 'live-preview-enabled', 'zoomed-banner1', 'zoomed-banner2' );
    });

    previewSizeSelect.addEventListener( 'change', (e) => {
        setPreviewSize( previewSizeSelect.value );
    });

    window.addEventListener( 'resize', (e) => {
        setPreviewSize( previewSizeSelect.value );
    });

    // Set initial size
    if ( previewOptions.device === 'm' ) {
        previewSizeSelect.value = '390x844';
    } else {
        previewSizeSelect.value = '1280x720';
    }
    setPreviewSize( previewSizeSelect.value );

    document.getElementById( 'zoom-both' ).addEventListener( 'click', (e) => {
        bodyClasses.remove( 'zoomed-banner1', 'zoomed-banner2' );
    });
    document.getElementById( 'zoom-banner1' ).addEventListener( 'click', (e) => {
        bodyClasses.remove( 'zoomed-banner2' );
        bodyClasses.add( 'zoomed-banner1' );
    });
    document.getElementById( 'zoom-banner2' ).addEventListener( 'click', (e) => {
        bodyClasses.remove( 'zoomed-banner1' );
        bodyClasses.add( 'zoomed-banner2' );
    });

    document.getElementById( 'refresh-banner1' ).addEventListener( 'click', (e) => {
        document.getElementById('live-preview-banner1').src = document.getElementById('live-preview-banner1').src;
    });
    document.getElementById( 'refresh-banner2' ).addEventListener( 'click', (e) => {
        document.getElementById('live-preview-banner2').src = document.getElementById('live-preview-banner2').src;
    });

    function updatePreviewUrls() {

        var previewUrl1 = previewUrl( banner1, previewOptions ),
            previewUrl2 = previewUrl( banner2, previewOptions );

        document.getElementById( 'preview-banner1' ).setAttribute( 'href', previewUrl1 );
        document.getElementById( 'preview-banner2' ).setAttribute( 'href', previewUrl2 );

        if ( bodyClasses.contains( 'live-preview-enabled' ) ) {
            const previewFrame1 = document.getElementById( 'live-preview-banner1' );
            const previewFrame2 = document.getElementById( 'live-preview-banner2' );

            // Only do this if wasn't set already, to avoid repeated loads
            if ( previewFrame1.getAttribute( 'src' ) !== previewUrl1 ) {
                previewFrame1.setAttribute( 'src', previewUrl1 );
            }
            if ( previewFrame2.getAttribute( 'src' ) !== previewUrl2 ) {
                previewFrame2.setAttribute( 'src', previewUrl2 );
            }
        }
    }

    function enableLivePreview() {
        bodyClasses.add( 'live-preview-enabled' );
        updatePreviewUrls();
        setPreviewSize( previewSizeSelect.value );
    }

    function setPreviewSize( sizeString ) {
        const scaleLevels = [ 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1 ];
        const screenWidth = window.innerWidth;
        const availWidth = ( screenWidth / 2 ) - 40;
        let width, height, scale, scaleZoomed;

        [ width, height ] = sizeString.split('x');

        for (let i = scaleLevels.length; i >= 0; i--) {
            scale = scaleLevels[i];
            if ( width * scale < availWidth ) {
                break;
            }
        }
        scaleZoomed = Math.min( scale * 2, 1 );

        document.documentElement.style.cssText = `
            --preview-width: ${width}px;
            --preview-height: ${height}px;
            --preview-scale: ${scale};
            --preview-scale-zoomed: ${scaleZoomed};
        `

        document.getElementById('scale-amount').textContent = scale;
        document.getElementById('scale-amount-zoomed').textContent = scaleZoomed;

    }

    // Keyboard shortcuts
    document.addEventListener( 'keydown', (e) => {

        if ( e.target.tagName === 'INPUT' ) {
            return false;
        }

        const keyName = e.key;
        const livePreviewEnabled = bodyClasses.contains( 'live-preview-enabled' );
        switch (keyName) {
            case 'p':
                enableLivePreview();
                break;
            case 'd':
                bodyClasses.remove( 'live-preview-enabled', 'zoomed-banner1', 'zoomed-banner2' );
                break;
            case 'r':
                if ( livePreviewEnabled ) {
                    previewSizeSelect.showPicker();
                }
                break;
            case 'Escape':
            case '0':
                bodyClasses.remove( 'zoomed-banner1', 'zoomed-banner2' );
                break;
            case '1':
                if ( livePreviewEnabled ) {
                    bodyClasses.remove( 'zoomed-banner2' );
                    bodyClasses.toggle( 'zoomed-banner1' );
                }
                break;
            case '2':
                if ( livePreviewEnabled ) {
                    bodyClasses.remove( 'zoomed-banner1' );
                    bodyClasses.toggle( 'zoomed-banner2' );
                }
                break;            
            default:
                break;
        }

    });

    function setTheme( theme ) {
        document.documentElement.setAttribute( 'data-theme', theme );
    }

    document.getElementById('enable-dark-theme').addEventListener( 'click', function() {
        setTheme( 'dark' );
        localStorage.setItem( 'diffTheme', 'dark' );
    });
    document.getElementById('enable-light-theme').addEventListener( 'click', function() {
        setTheme( 'light' );
        localStorage.setItem( 'diffTheme', 'light' );
    });

    var localStorageTheme = localStorage.getItem( 'diffTheme' );
    if ( localStorageTheme ) {
        setTheme( localStorageTheme );
    } else if ( window.matchMedia( '(prefers-color-scheme: dark)' ).matches ) {
        setTheme( 'dark' );
    } else if ( window.matchMedia( '(prefers-color-scheme: light)' ).matches ) {
        setTheme( 'light' );
    }

})();
