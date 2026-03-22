
(function (global) {
  'use strict';


  var LANGUAGES = [
    { code: 'af',    name: 'Afrikaans',            native: 'Afrikaans'        },
    { code: 'sq',    name: 'Albanian',              native: 'Shqip'            },
    { code: 'am',    name: 'Amharic',               native: 'አማርኛ'             },
    { code: 'ar',    name: 'Arabic',                native: 'العربية'           },
    { code: 'hy',    name: 'Armenian',              native: 'Հայերեն'          },
    { code: 'az',    name: 'Azerbaijani',           native: 'Azərbaycan'       },
    { code: 'eu',    name: 'Basque',                native: 'Euskara'          },
    { code: 'be',    name: 'Belarusian',            native: 'Беларуская'       },
    { code: 'bn',    name: 'Bengali',               native: 'বাংলা'            },
    { code: 'bs',    name: 'Bosnian',               native: 'Bosanski'         },
    { code: 'bg',    name: 'Bulgarian',             native: 'Български'        },
    { code: 'ca',    name: 'Catalan',               native: 'Català'           },
    { code: 'zh-CN', name: 'Chinese (Simplified)',  native: '中文（简体）'        },
    { code: 'zh-TW', name: 'Chinese (Traditional)', native: '中文（繁體）'        },
    { code: 'hr',    name: 'Croatian',              native: 'Hrvatski'         },
    { code: 'cs',    name: 'Czech',                 native: 'Čeština'          },
    { code: 'da',    name: 'Danish',                native: 'Dansk'            },
    { code: 'nl',    name: 'Dutch',                 native: 'Nederlands'       },
    { code: 'en',    name: 'English',               native: 'English'          },
    { code: 'en-CA', name: 'Canadian English',       native: 'Canadian English'  },
    { code: 'et',    name: 'Estonian',              native: 'Eesti'            },
    { code: 'fi',    name: 'Finnish',               native: 'Suomi'            },
    { code: 'fr',    name: 'French',                native: 'Français'         },
    { code: 'gl',    name: 'Galician',              native: 'Galego'           },
    { code: 'ka',    name: 'Georgian',              native: 'ქართული'          },
    { code: 'de',    name: 'German',                native: 'Deutsch'          },
    { code: 'el',    name: 'Greek',                 native: 'Ελληνικά'         },
    { code: 'gu',    name: 'Gujarati',              native: 'ગુજરાતી'          },
    { code: 'ht',    name: 'Haitian Creole',        native: 'Kreyòl Ayisyen'  },
    { code: 'ha',    name: 'Hausa',                 native: 'Hausa'            },
    { code: 'he',    name: 'Hebrew',                native: 'עברית'            },
    { code: 'hi',    name: 'Hindi',                 native: 'हिन्दी'           },
    { code: 'hu',    name: 'Hungarian',             native: 'Magyar'           },
    { code: 'is',    name: 'Icelandic',             native: 'Íslenska'         },
    { code: 'ig',    name: 'Igbo',                  native: 'Igbo'             },
    { code: 'id',    name: 'Indonesian',            native: 'Bahasa Indonesia' },
    { code: 'ga',    name: 'Irish',                 native: 'Gaeilge'          },
    { code: 'it',    name: 'Italian',               native: 'Italiano'         },
    { code: 'ja',    name: 'Japanese',              native: '日本語'            },
    { code: 'kn',    name: 'Kannada',               native: 'ಕನ್ನಡ'            },
    { code: 'kk',    name: 'Kazakh',                native: 'Қазақ'            },
    { code: 'km',    name: 'Khmer',                 native: 'ខ្មែរ'             },
    { code: 'ko',    name: 'Korean',                native: '한국어'            },
    { code: 'lo',    name: 'Lao',                   native: 'ລາວ'              },
    { code: 'lv',    name: 'Latvian',               native: 'Latviešu'         },
    { code: 'lt',    name: 'Lithuanian',            native: 'Lietuvių'         },
    { code: 'lb',    name: 'Luxembourgish',         native: 'Lëtzebuergesch'   },
    { code: 'mk',    name: 'Macedonian',            native: 'Македонски'       },
    { code: 'ms',    name: 'Malay',                 native: 'Bahasa Melayu'    },
    { code: 'ml',    name: 'Malayalam',             native: 'മലയാളം'           },
    { code: 'mt',    name: 'Maltese',               native: 'Malti'            },
    { code: 'mi',    name: 'Māori',                 native: 'Māori'            },
    { code: 'mr',    name: 'Marathi',               native: 'मराठी'            },
    { code: 'mn',    name: 'Mongolian',             native: 'Монгол'           },
    { code: 'my',    name: 'Burmese',               native: 'မြန်မာ'            },
    { code: 'ne',    name: 'Nepali',                native: 'नेपाली'           },
    { code: 'no',    name: 'Norwegian',             native: 'Norsk'            },
    { code: 'fa',    name: 'Persian',               native: 'فارسی'            },
    { code: 'pl',    name: 'Polish',                native: 'Polski'           },
    { code: 'pt',    name: 'Portuguese',            native: 'Português'        },
    { code: 'pa',    name: 'Punjabi',               native: 'ਪੰਜਾਬੀ'           },
    { code: 'ro',    name: 'Romanian',              native: 'Română'           },
    { code: 'ru',    name: 'Russian',               native: 'Русский'          },
    { code: 'sr',    name: 'Serbian',               native: 'Српски'           },
    { code: 'si',    name: 'Sinhala',               native: 'සිංහල'            },
    { code: 'sk',    name: 'Slovak',                native: 'Slovenčina'       },
    { code: 'sl',    name: 'Slovenian',             native: 'Slovenščina'      },
    { code: 'so',    name: 'Somali',                native: 'Soomaali'         },
    { code: 'es',    name: 'Spanish',               native: 'Español'          },
    { code: 'sw',    name: 'Swahili',               native: 'Kiswahili'        },
    { code: 'sv',    name: 'Swedish',               native: 'Svenska'          },
    { code: 'tl',    name: 'Filipino',              native: 'Filipino'         },
    { code: 'ta',    name: 'Tamil',                 native: 'தமிழ்'            },
    { code: 'te',    name: 'Telugu',                native: 'తెలుగు'           },
    { code: 'th',    name: 'Thai',                  native: 'ภาษาไทย'          },
    { code: 'tr',    name: 'Turkish',               native: 'Türkçe'           },
    { code: 'uk',    name: 'Ukrainian',             native: 'Українська'       },
    { code: 'ur',    name: 'Urdu',                  native: 'اردو'             },
    { code: 'uz',    name: 'Uzbek',                 native: "O'zbek"           },
    { code: 'vi',    name: 'Vietnamese',            native: 'Tiếng Việt'       },
    { code: 'cy',    name: 'Welsh',                 native: 'Cymraeg'          },
    { code: 'xh',    name: 'Xhosa',                 native: 'isiXhosa'         },
    { code: 'yi',    name: 'Yiddish',               native: 'ייִדיש'            },
    { code: 'yo',    name: 'Yoruba',                native: 'Yorùbá'           },
    { code: 'zu',    name: 'Zulu',                  native: 'isiZulu'          },
  ];

  
  var FI_MAP = {
    af: 'za', sq: 'al', am: 'et', ar: 'sa', hy: 'am', az: 'az', eu: 'es-pv',
    be: 'by', bn: 'bd', bs: 'ba', bg: 'bg', ca: 'es-ct', 'zh-CN': 'cn', 'zh-TW': 'tw',
    hr: 'hr', cs: 'cz', da: 'dk', nl: 'nl', en: 'gb', 'en-CA': 'ca', et: 'ee', fi: 'fi', fr: 'fr',
    gl: 'es-ga', ka: 'ge', de: 'de', el: 'gr', gu: 'in', ht: 'ht', ha: 'ng', he: 'il',
    hi: 'in', hu: 'hu', is: 'is', ig: 'ng', id: 'id', ga: 'ie', it: 'it', ja: 'jp',
    kn: 'in', kk: 'kz', km: 'kh', ko: 'kr', lo: 'la', lv: 'lv', lt: 'lt', lb: 'lu',
    mk: 'mk', ms: 'my', ml: 'in', mt: 'mt', mi: 'nz', mr: 'in', mn: 'mn', my: 'mm',
    ne: 'np', no: 'no', fa: 'ir', pl: 'pl', pt: 'pt', pa: 'in', ro: 'ro', ru: 'ru',
    sr: 'rs', si: 'lk', sk: 'sk', sl: 'si', so: 'so', es: 'es', sw: 'ke', sv: 'se',
    tl: 'ph', ta: 'in', te: 'in', th: 'th', tr: 'tr', uk: 'ua', ur: 'pk', uz: 'uz',
    vi: 'vn', cy: 'gb-wls', xh: 'za', yi: 'il', yo: 'ng', zu: 'za',
  };

  var SUGGESTED = ['es','fr','de','zh-CN','ja','ar','pt','hi','ru','ko'];
  var ORIGINAL  = 'en';
  var STORE_KEY = 'ls_selected_lang';


  var current   = ORIGINAL;
  var panelOpen = false;
  
  var undoFrom  = null;


  function getLang(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return null;
  }

  function escAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function flagIconClass(iso) {
    if (!iso) return '';
    return 'fi fi-' + iso.replace(/_/g, '-');
  }

  function flagMarkup(langCode, size) {
    var iso = FI_MAP[langCode];
    var sizeCls = size ? ' ls-fi--' + size : '';
    if (iso) {
      return (
        '<span class="' +
        flagIconClass(iso) +
        ' ls-fi' +
        sizeCls +
        '" role="img" aria-hidden="true"></span>'
      );
    }
    return (
      '<span class="ls-fi ls-fi-fallback' +
      sizeCls +
      '" aria-hidden="true">' +
      '<svg class="ls-fi-globe" viewBox="0 0 24 24" width="16" height="16">' +
      '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.75"/>' +
      '<path d="M2 12h20M12 2c-2.5 3.3-4 6.6-4 10s1.5 6.7 4 10M12 2c2.5 3.3 4 6.6 4 10s-1.5 6.7-4 10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></span>'
    );
  }

  function readStore()   { try { return localStorage.getItem(STORE_KEY); } catch(e) { return null; } }
  function writeStore(v) { try { localStorage.setItem(STORE_KEY, v);     } catch(e) {} }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setCookie(name, val) {
    var exp = new Date(Date.now() + 365 * 864e5).toUTCString();
    var base = name + '=' + encodeURIComponent(val) + '; expires=' + exp + '; path=/';
    document.cookie = base;
    try { document.cookie = base + '; domain=.' + location.hostname; } catch(e) {}
  }

  function eraseCookie(name) {
    var past = 'Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = name + '=; expires=' + past + '; path=/';
    try { document.cookie = name + '=; expires=' + past + '; path=/; domain=.' + location.hostname; } catch(e) {}
  }

  function fireChange(el) {
    try { el.dispatchEvent(new Event('change', { bubbles: true })); }
    catch(e) { var ev = document.createEvent('HTMLEvents'); ev.initEvent('change', true, true); el.dispatchEvent(ev); }
  }


  function applyTranslation(code) {
    if (code === ORIGINAL) { doReset(); return; }
    var sel = document.querySelector('select.goog-te-combo');
    if (sel) { sel.value = code; fireChange(sel); }
    else { setCookie('googtrans', '/en/' + code); location.reload(); }
  }

  function doReset() {
    eraseCookie('googtrans');
    try {
      var fr = document.querySelector('.goog-te-banner-frame');
      if (fr) {
        var doc = fr.contentDocument || fr.contentWindow.document;
        var btn = doc.querySelector('.goog-te-button button');
        if (btn) { btn.click(); return; }
      }
    } catch(e) {}
    location.reload();
  }

  function loadGoogleTranslate() {
    var suppress = document.createElement('style');
    suppress.textContent =
      '.goog-te-banner-frame,.goog-te-balloon-frame,' +
      '.VIpgJd-ZVi9od-aZ2wEe-wOHMyf,.VIpgJd-ZVi9od-ORHb,' +
      '.goog-te-gadget,.skiptranslate,#ls-gt-el{' +
        'display:none!important;visibility:hidden!important}' +
      'body{top:0!important}';
    document.head.appendChild(suppress);

    global.googleTranslateElementInit = function () {
      
      new google.translate.TranslateElement(
        { pageLanguage: ORIGINAL, autoDisplay: false },
        'ls-gt-el'
      );
    };

    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }


  function ensureFlagIconsCss() {
    if (document.querySelector('link[href*="flag-icons"][rel="stylesheet"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/css/flag-icons.min.css';
    document.head.insertBefore(l, document.head.firstChild);
  }

  function injectStyles() {
    var el = document.createElement('style');
    el.id = 'ls-styles';
    
    el.textContent =
      
      '#ls-root,#ls-notice{' +
        '--lsa:#c44d2a;--lsah:#a33f22;--lsas:rgba(196,77,42,.09);--lsah2:rgba(196,77,42,.15);' +
        '--lsbg:#f8f6f3;--lssf:#fff;--lsbd:#e5e2de;' +
        '--lst:#1a1a1a;--lst2:#4a4a4a;--lstm:#6b6b6b;' +
        '--lsr:16px;--lsrsm:12px;' +
        '--lssh:0 24px 64px rgba(0,0,0,.12),0 8px 24px rgba(0,0,0,.06);' +
        '--lse:cubic-bezier(.4,0,.2,1);--lsd:.22s;' +
        '--lsf:"Work Sans",system-ui,sans-serif;' +
        '--lsfh:"Fredoka",system-ui,sans-serif;' +
      '}' +

      
      '#ls-trigger{' +
        'position:fixed;top:60px;right:12px;z-index:9990;' +
        'display:flex;align-items:center;gap:8px;' +
        'padding:10px 16px 10px 12px;' +
        'background:var(--lssf);border:1.5px solid var(--lsbd);border-radius:100px;' +
        'font-family:var(--lsf);font-size:.875rem;font-weight:600;color:var(--lst);' +
        'cursor:pointer;white-space:nowrap;' +
        'box-shadow:0 2px 12px rgba(0,0,0,.06),0 1px 3px rgba(0,0,0,.04);' +
        'transition:transform var(--lsd) var(--lse),box-shadow var(--lsd) var(--lse),' +
          'border-color var(--lsd) var(--lse),background var(--lsd) var(--lse),color var(--lsd) var(--lse);' +
        '-webkit-tap-highlight-color:transparent;outline:none;' +
      '}' +
      '#ls-trigger:hover{' +
        'border-color:var(--lsa);transform:translateY(-1px);' +
        'box-shadow:0 8px 28px rgba(0,0,0,.1),0 0 0 1px color-mix(in srgb,var(--lsa) 22%,transparent);' +
      '}' +
      '#ls-trigger:focus-visible{outline:2.5px solid var(--lsa);outline-offset:3px}' +
      '#ls-trigger:active{transform:translateY(0)}' +
      '#ls-trigger.ls-on{background:var(--lsa);border-color:var(--lsa);color:#fff;' +
        'box-shadow:0 4px 20px color-mix(in srgb,var(--lsa) 45%,transparent)}' +
      '#ls-trigger.ls-on:hover{background:var(--lsah);border-color:var(--lsah)}' +
      '.ls-trig-flag{display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
        'width:22px;height:16px;border-radius:3px;overflow:hidden;' +
        'box-shadow:0 0 0 1px rgba(0,0,0,.08);background:var(--lsbg)}' +
      '#ls-trigger.ls-on .ls-trig-flag{box-shadow:0 0 0 1px rgba(255,255,255,.35)}' +
      '#ls-trig-flag .ls-fi--trig.fi{width:22px!important;height:16px!important;' +
        'background-size:cover!important;background-position:50%!important}' +
      '#ls-trig-flag .ls-fi-fallback{width:100%;height:100%}' +
      '#ls-trig-flag .ls-fi-globe{width:14px;height:14px}' +
      '#ls-trig-lbl{font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}' +

      
      '#ls-bd{' +
        'position:fixed;inset:0;z-index:9991;' +
        'background:rgba(17,24,39,.06);' +
        'opacity:0;visibility:hidden;pointer-events:none;' +
        'transition:opacity .1s ease,visibility .1s ease;' +
      '}' +
      '#ls-bd.ls-open{opacity:1;visibility:visible;pointer-events:auto}' +

      
      '#ls-panel{' +
        'position:fixed;z-index:9992;' +
        'background:var(--lssf);border:1px solid var(--lsbd);' +
        'border-radius:var(--lsr);box-shadow:var(--lssh);' +
        'width:min(520px,calc(100vw - 32px));' +
        'max-height:min(600px,calc(100dvh - 40px));' +
        'display:flex;flex-direction:column;overflow:hidden;' +
        'opacity:0;visibility:hidden;pointer-events:none;' +
        'transform:translate(-50%,-50%);transform-origin:center center;' +
        'transition:opacity .12s ease,visibility .12s ease;' +
        'top:50%;left:50%;' +
      '}' +
      '@media (min-width:769px){' +
        '#ls-panel{' +
          'width:min(592px,calc(100vw - 48px));' +
          'max-height:min(640px,calc(100dvh - 48px));' +
          'border-radius:20px;' +
          'box-shadow:0 32px 80px rgba(0,32,64,.14),0 12px 32px rgba(0,0,0,.08),0 0 0 1px rgba(0,32,64,.04);' +
        '}' +
        '.ls-ph{padding:26px 24px 18px;' +
          'background:linear-gradient(180deg,color-mix(in srgb,var(--lsa) 6%,var(--lssf)) 0%,var(--lssf) 55%)}' +
        '.ls-ph h2{font-size:1.45rem}' +
        '.ls-ph p{font-size:.8125rem}' +
        '.ls-sw{padding:16px 20px 12px}' +
        '#ls-scroll{padding:0 16px 16px}' +
        '.ls-sl{padding:16px 6px 10px;font-size:.68rem}' +
        '.ls-sg{grid-template-columns:repeat(3,1fr);gap:10px}' +
        '.ls-chip{padding:12px 14px;border-radius:12px;min-height:52px}' +
        '.ls-li{padding:11px 14px;border-radius:12px}' +
        '.ls-pf{padding:14px 20px 20px}' +
        '.ls-disc{padding:12px 16px;margin-bottom:12px}' +
      '}' +
      '#ls-panel.ls-open{opacity:1;visibility:visible;transform:translate(-50%,-50%);pointer-events:auto}' +
      '#ls-panel[hidden]{display:none}' +

      
      '.ls-ph{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;' +
        'padding:22px 20px 16px;border-bottom:1px solid var(--lsbd);flex-shrink:0}' +
      '.ls-ph h2{font-family:var(--lsfh);font-size:1.28rem;font-weight:700;' +
        'color:var(--lst);letter-spacing:-.01em;line-height:1.2;margin:0 0 3px}' +
      '.ls-ph p{font-family:var(--lsf);font-size:.79rem;color:var(--lstm);margin:0;line-height:1.4}' +
      '.ls-x{display:flex;align-items:center;justify-content:center;' +
        'width:32px;height:32px;border-radius:8px;border:none;' +
        'background:transparent;color:var(--lstm);cursor:pointer;flex-shrink:0;padding:0;' +
        'transition:background var(--lsd) var(--lse),color var(--lsd) var(--lse);' +
        '-webkit-tap-highlight-color:transparent;outline:none}' +
      '.ls-x:hover{background:var(--lsbg);color:var(--lst)}' +
      '.ls-x:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '.ls-x svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round}' +

      
      '.ls-sw{position:relative;padding:13px 16px 9px;flex-shrink:0}' +
      '.ls-si{position:absolute;left:28px;top:50%;transform:translateY(-50%);' +
        'width:15px;height:15px;stroke:var(--lstm);fill:none;' +
        'stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}' +
      '#ls-search{width:100%;padding:10px 36px 10px 37px;' +
        'border:1.5px solid var(--lsbd);border-radius:var(--lsrsm);' +
        'font-family:var(--lsf);font-size:.9375rem;color:var(--lst);' +
        'background:var(--lsbg);outline:none;' +
        'transition:border-color var(--lsd) var(--lse),box-shadow var(--lsd) var(--lse),background var(--lsd) var(--lse);' +
        '-webkit-appearance:none;appearance:none}' +
      '#ls-search::placeholder{color:var(--lstm)}' +
      '#ls-search:focus{border-color:var(--lsa);background:var(--lssf);box-shadow:0 0 0 3px var(--lsas)}' +
      '#ls-search::-webkit-search-cancel-button{display:none}' +
      '#ls-sc{position:absolute;right:27px;top:50%;transform:translateY(-50%);' +
        'display:flex;align-items:center;justify-content:center;' +
        'width:19px;height:19px;border-radius:50%;border:none;' +
        'background:var(--lstm);color:#fff;cursor:pointer;padding:0;' +
        'transition:background var(--lsd) var(--lse);-webkit-tap-highlight-color:transparent}' +
      '#ls-sc:hover{background:var(--lst2)}' +
      '#ls-sc svg{width:9px;height:9px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round}' +
      '#ls-sc[hidden]{display:none}' +

      
      '#ls-scroll{flex:1;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;' +
        'padding:0 12px 12px;scroll-behavior:smooth}' +
      '#ls-scroll::-webkit-scrollbar{width:4px}' +
      '#ls-scroll::-webkit-scrollbar-track{background:transparent}' +
      '#ls-scroll::-webkit-scrollbar-thumb{background:var(--lsbd);border-radius:2px}' +
      '#ls-scroll::-webkit-scrollbar-thumb:hover{background:#cbc7c2}' +

      
      '.ls-sl{font-family:var(--lsf);font-size:.64rem;font-weight:700;' +
        'text-transform:uppercase;letter-spacing:.09em;color:var(--lstm);padding:14px 4px 7px}' +

      
      '.ls-sg{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:2px}' +
      '.ls-chip{display:flex;align-items:center;gap:8px;padding:9px 11px;' +
        'border:1.5px solid var(--lsbd);border-radius:var(--lsrsm);' +
        'background:transparent;font-family:var(--lsf);cursor:pointer;' +
        'text-align:left;width:100%;' +
        'transition:border-color var(--lsd) var(--lse),background var(--lsd) var(--lse),box-shadow var(--lsd) var(--lse);' +
        '-webkit-tap-highlight-color:transparent;outline:none}' +
      '.ls-chip:hover{border-color:var(--lsa);background:var(--lsas)}' +
      '.ls-chip:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '.ls-chip.ls-sel{border-color:var(--lsa);background:var(--lsas);box-shadow:0 0 0 1px var(--lsa)}' +
      '.ls-cf{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:30px;height:22px}' +
      '#ls-root .ls-cf .ls-fi.fi{width:28px!important;height:19px!important;min-width:28px;border-radius:3px;' +
        'background-size:cover!important;background-position:50%!important}' +
      '#ls-root .ls-cf .ls-fi-fallback{width:28px;height:19px}' +
      '#ls-root .ls-cf .ls-fi-globe{width:15px;height:15px}' +
      '.ls-ct{min-width:0;flex:1}' +
      '.ls-cn{display:block;font-size:.8rem;font-weight:600;color:var(--lst);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ls-cv{display:block;font-size:.68rem;color:var(--lstm);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ls-ck{margin-left:auto;flex-shrink:0;color:var(--lsa);display:none}' +
      '.ls-sel .ls-ck{display:flex;align-items:center}' +
      '.ls-ck svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}' +

      
      '.ls-ll{display:flex;flex-direction:column;gap:1px}' +
      '.ls-li{display:flex;align-items:center;gap:12px;padding:9px 12px;' +
        'border-radius:var(--lsrsm);border:1.5px solid transparent;' +
        'background:transparent;font-family:var(--lsf);cursor:pointer;' +
        'text-align:left;width:100%;' +
        'transition:border-color var(--lsd) var(--lse),background var(--lsd) var(--lse);' +
        '-webkit-tap-highlight-color:transparent;outline:none}' +
      '.ls-li:hover{background:var(--lsbg);border-color:var(--lsbd)}' +
      '.ls-li:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '.ls-li.ls-sel{background:var(--lsas);border-color:var(--lsa)}' +
      '.ls-lf{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:38px;height:26px}' +
      '#ls-root .ls-lf .ls-fi.fi{width:30px!important;height:20px!important;min-width:30px;border-radius:3px}' +
      '#ls-root .ls-lf .ls-fi-fallback{width:30px;height:20px}' +
      '#ls-root .ls-lf .ls-fi-globe{width:18px;height:18px}' +
      '.ls-lt{flex:1;min-width:0}' +
      '.ls-ln{display:block;font-size:.875rem;font-weight:600;color:var(--lst);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ls-lv{display:block;font-size:.77rem;color:var(--lstm);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.ls-lk{flex-shrink:0;color:var(--lsa);display:none;margin-left:auto}' +
      '.ls-li.ls-sel .ls-lk{display:flex;align-items:center}' +
      '.ls-lk svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}' +

      
      '#ls-nores{padding:28px 8px;text-align:center;font-family:var(--lsf);color:var(--lstm);font-size:.875rem;line-height:1.5}' +
      '#ls-nores strong{color:var(--lst2)}' +
      '#ls-nores[hidden]{display:none}' +

      
      '.ls-pf{padding:10px 16px 16px;border-top:1px solid var(--lsbd);flex-shrink:0}' +

      
      '.ls-disc{display:flex;gap:10px;align-items:flex-start;' +
        'padding:11px 14px;margin-bottom:10px;' +
        'background:#faf9f7;border:1px solid var(--lsbd);border-radius:var(--lsrsm)}' +
      '.ls-di{width:14px;height:14px;flex-shrink:0;margin-top:1.5px;' +
        'stroke:var(--lstm);fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}' +
      '.ls-disc p{font-family:var(--lsf);font-size:.72rem;color:var(--lstm);line-height:1.55;margin:0}' +

      
      '#ls-reset{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;' +
        'padding:10px 16px;background:transparent;' +
        'border:1.5px solid var(--lsbd);border-radius:var(--lsrsm);' +
        'font-family:var(--lsf);font-size:.875rem;font-weight:500;color:var(--lst2);' +
        'cursor:pointer;' +
        'transition:border-color var(--lsd) var(--lse),background var(--lsd) var(--lse),color var(--lsd) var(--lse);' +
        '-webkit-tap-highlight-color:transparent;outline:none}' +
      '#ls-reset:hover{border-color:var(--lsa);color:var(--lsa);background:var(--lsas)}' +
      '#ls-reset:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '#ls-reset svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
      '#ls-reset[hidden]{display:none}' +

      
      '#ls-notice{position:fixed;bottom:0;left:0;right:0;z-index:9989;' +
        'background:var(--lssf);border-top:1px solid var(--lsbd);' +
        'padding:9px 20px;box-shadow:0 -4px 24px rgba(0,0,0,.07);' +
        'transition:transform var(--lsd) var(--lse)}' +
      '#ls-notice[hidden]{display:none}' +
      '.ls-ni{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:10px;' +
        'font-family:var(--lsf);font-size:.8rem}' +
      '.ls-ni-icon{width:15px;height:15px;flex-shrink:0;stroke:var(--lsa);fill:none;' +
        'stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}' +
      '#ls-ntxt{flex:1;color:var(--lst2)}' +
      '#ls-ntxt strong{color:var(--lst);font-weight:600}' +
      '#ls-norig{font-family:var(--lsf);font-size:.79rem;font-weight:600;color:var(--lsa);' +
        'background:var(--lsas);border:1px solid color-mix(in srgb,var(--lsa) 28%,var(--lsbd));' +
        'border-radius:6px;padding:5px 12px;cursor:pointer;white-space:nowrap;' +
        'transition:background var(--lsd) var(--lse);-webkit-tap-highlight-color:transparent;outline:none}' +
      '#ls-norig:hover{background:var(--lsah2)}' +
      '#ls-norig:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '#ls-undo{font-family:var(--lsf);font-size:.79rem;font-weight:600;color:var(--lst2);' +
        'background:var(--lsbg);border:1px solid var(--lsbd);border-radius:6px;padding:5px 12px;' +
        'cursor:pointer;white-space:nowrap;' +
        'transition:background var(--lsd) var(--lse),border-color var(--lsd) var(--lse),color var(--lsd) var(--lse);' +
        '-webkit-tap-highlight-color:transparent;outline:none;flex-shrink:0}' +
      '#ls-undo:hover{background:var(--lssf);border-color:var(--lsa);color:var(--lsa)}' +
      '#ls-undo:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '#ls-undo[hidden]{display:none!important}' +
      '#ls-nclose{display:flex;align-items:center;justify-content:center;' +
        'width:26px;height:26px;border-radius:6px;border:none;' +
        'background:transparent;color:var(--lstm);cursor:pointer;flex-shrink:0;padding:0;' +
        'transition:background var(--lsd) var(--lse);-webkit-tap-highlight-color:transparent;outline:none}' +
      '#ls-nclose:hover{background:var(--lsbg)}' +
      '#ls-nclose:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '#ls-nclose svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round}' +

      
      '@media(max-width:520px){' +
        '#ls-panel{position:fixed;bottom:0;left:0;right:0;top:auto;' +
          'width:100%;max-width:100%;' +
          'border-radius:18px 18px 0 0;transform-origin:bottom center;' +
          'max-height:min(88dvh,calc(100dvh - env(safe-area-inset-bottom,0px) - 12px));' +
          'transform:translateY(100%);' +
          'transition:opacity .14s ease,transform .2s var(--lse),visibility .14s ease}' +
        '#ls-panel.ls-open{transform:translateY(0)}' +
      '}' +
      '@media(max-width:540px){' +
        '#ls-trigger{top:56px;right:8px;padding:10px 14px 10px 12px}' +
        '#ls-root.ls-inline #ls-trigger{top:auto;right:auto;padding:11px 18px 11px 13px}' +
        '#ls-panel{max-height:82dvh}' +
        '.ls-ni{flex-wrap:wrap;gap:7px}' +
        '#ls-ntxt{flex-basis:100%}' +
        '#ls-undo,#ls-norig{margin-left:0}' +
        '#ls-norig{margin-left:auto}' +
      '}' +

      
      '#ls-root.ls-inline{display:contents}' +
      '#ls-root.ls-inline #ls-trigger{' +
        'position:relative;top:auto;right:auto;' +
        'box-shadow:0 1px 3px rgba(0,32,64,.1),0 1px 2px rgba(0,0,0,.06);' +
      '}' +
      '#ls-root.ls-inline #ls-trigger:hover{' +
        'box-shadow:0 4px 14px rgba(12,168,200,.2),0 1px 3px rgba(0,32,64,.08);' +
      '}' +
      '#ls-root.ls-inline #ls-trigger.ls-on{' +
        'box-shadow:0 2px 12px rgba(12,168,200,.35);' +
      '}' +

      
      '@media(prefers-reduced-motion:reduce){' +
        '#ls-trigger,#ls-bd,#ls-panel,#ls-notice{transition:none!important}' +
      '}' +

      
      '.goog-te-banner-frame,.goog-te-balloon-frame,' +
      '.VIpgJd-ZVi9od-aZ2wEe-wOHMyf,.VIpgJd-ZVi9od-ORHb,' +
      '.goog-te-gadget,.skiptranslate,#ls-gt-el{display:none!important;visibility:hidden!important}' +
      'body{top:0!important}';

    document.head.appendChild(el);
  }


  var S = {
    globe:
      '<svg class="ls-trig-icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<path d="M2 12h20"/>' +
        '<path d="M12 2c-2.5 3.3-4 6.6-4 10s1.5 6.7 4 10"/>' +
        '<path d="M12 2c2.5 3.3 4 6.6 4 10s-1.5 6.7-4 10"/>' +
      '</svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    search:
      '<svg class="ls-si" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>' +
      '</svg>',
    info:
      '<svg class="ls-di" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<path d="M12 16v-4M12 8h.01"/>' +
      '</svg>',
    reset:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>' +
        '<path d="M3 3v5h5"/>' +
      '</svg>',
    globeNi:
      '<svg class="ls-ni-icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10"/>' +
        '<path d="M2 12h20"/>' +
        '<path d="M12 2c-2.5 3.3-4 6.6-4 10s1.5 6.7 4 10"/>' +
        '<path d="M12 2c2.5 3.3 4 6.6 4 10s-1.5 6.7-4 10"/>' +
      '</svg>',
  };


  function buildDOM() {
    var root = document.createElement('div');
    root.id = 'ls-root';
    root.classList.add('notranslate');
    root.setAttribute('translate', 'no');
    root.innerHTML =
      '<div id="ls-gt-el" aria-hidden="true" style="display:none;position:absolute"></div>' +

      
      '<button id="ls-trigger" type="button" ' +
          'aria-label="Select language" aria-expanded="false" aria-controls="ls-panel">' +
        '<span id="ls-trig-flag" class="ls-trig-flag"></span>' +
        '<span id="ls-trig-lbl">EN</span>' +
      '</button>' +

      
      '<div id="ls-bd" aria-hidden="true"></div>' +

      
      '<div id="ls-panel" role="dialog" aria-modal="true" aria-label="Language selector" hidden>' +
        
        '<div class="ls-ph">' +
          '<div>' +
            '<h2>Choose your language</h2>' +
            '<p>View this page in your preferred language</p>' +
          '</div>' +
          '<button class="ls-x" id="ls-close" type="button" aria-label="Close">' + S.x + '</button>' +
        '</div>' +
        
        '<div style="display:flex;flex-direction:column;overflow:hidden;flex:1;min-height:0">' +
          
          '<div class="ls-sw">' +
            S.search +
            '<input id="ls-search" type="search" placeholder="Search languages…" ' +
              'autocomplete="off" autocorrect="off" spellcheck="false" ' +
              'aria-label="Search languages" role="searchbox">' +
            '<button type="button" id="ls-sc" aria-label="Clear search" hidden>' + S.x + '</button>' +
          '</div>' +
          
          '<div id="ls-scroll">' +
            '<div id="ls-sugg-sec">' +
              '<div class="ls-sl">Suggested</div>' +
              '<div class="ls-sg" id="ls-sugg" role="list"></div>' +
            '</div>' +
            '<div id="ls-all-sec">' +
              '<div class="ls-sl">All languages</div>' +
              '<div class="ls-ll" id="ls-ll" role="list"></div>' +
            '</div>' +
            '<div id="ls-nores" hidden>' +
              '<p>No results for &ldquo;<strong id="ls-nores-q"></strong>&rdquo;</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        
        '<div class="ls-pf">' +
          '<div class="ls-disc">' +
            S.info +
            '<p>Translations are provided for convenience and may not fully capture the original meaning. <a id="ls-disc-link" href="#" style="color:inherit;text-decoration:underline">Language disclaimer</a></p>' +
          '</div>' +
          '<button id="ls-reset" type="button" hidden>' +
            S.reset + 'Return to original language' +
          '</button>' +
        '</div>' +
      '</div>';

    var mount = document.getElementById('situate-lang-mount');
    if (mount) {
      root.classList.add('ls-inline');
      mount.appendChild(root);
    } else {
      document.body.appendChild(root);
    }

    
    var noticeBar = document.createElement('div');
    noticeBar.id = 'ls-notice';
    noticeBar.setAttribute('role', 'status');
    noticeBar.setAttribute('aria-live', 'polite');
    noticeBar.setAttribute('hidden', '');
    noticeBar.innerHTML =
      '<div class="ls-ni">' +
        S.globeNi +
        '<span id="ls-ntxt"></span>' +
        '<button type="button" id="ls-undo" hidden>Previous language</button>' +
        '<button type="button" id="ls-norig">View original</button>' +
        '<button type="button" id="ls-nclose" aria-label="Dismiss notice">' + S.x + '</button>' +
      '</div>';
    document.body.appendChild(noticeBar);

    
    var discLink = document.getElementById('ls-disc-link');
    if (discLink) {
      var inDev = /\/_dev\//.test(location.pathname) || /\/_dev\//.test(location.href);
      discLink.href = inDev ? 'disclaimers.html#language-translations' : '_dev/disclaimers.html#language-translations';
    }
  }


  function chipHTML(l) {
    var s = current === l.code;
    return '<button type="button" class="ls-chip' + (s ? ' ls-sel' : '') +
      '" data-code="' + l.code + '" role="option" aria-selected="' + s + '" aria-label="' + escAttr(l.name) + '">' +
      '<span class="ls-cf" aria-hidden="true">' + flagMarkup(l.code, 'chip') + '</span>' +
      '<span class="ls-ct"><span class="ls-cn">' + l.name + '</span>' +
      '<span class="ls-cv">' + l.native + '</span></span>' +
      '<span class="ls-ck" aria-hidden="true">' + S.check + '</span></button>';
  }

  function itemHTML(l) {
    var s = current === l.code;
    return '<button type="button" class="ls-li' + (s ? ' ls-sel' : '') +
      '" data-code="' + l.code + '" role="option" aria-selected="' + s + '">' +
      '<span class="ls-lf" aria-hidden="true">' + flagMarkup(l.code, 'list') + '</span>' +
      '<span class="ls-lt"><span class="ls-ln">' + l.name + '</span>' +
      '<span class="ls-lv">' + l.native + '</span></span>' +
      '<span class="ls-lk" aria-hidden="true">' + S.check + '</span></button>';
  }

  function buildSuggested() {
    var g = document.getElementById('ls-sugg'), h = '';
    for (var i = 0; i < SUGGESTED.length; i++) {
      var l = getLang(SUGGESTED[i]);
      if (l) h += chipHTML(l);
    }
    g.innerHTML = h;
  }

  function buildList(q) {
    var ll      = document.getElementById('ls-ll');
    var nores   = document.getElementById('ls-nores');
    var noresQ  = document.getElementById('ls-nores-q');
    var suggSec = document.getElementById('ls-sugg-sec');
    var query   = (q || '').toLowerCase().trim();
    var h = '', count = 0;

    for (var i = 0; i < LANGUAGES.length; i++) {
      var l = LANGUAGES[i];
      if (!query ||
          l.name.toLowerCase().indexOf(query) !== -1 ||
          l.native.toLowerCase().indexOf(query) !== -1 ||
          l.code.toLowerCase().indexOf(query) !== -1) {
        h += itemHTML(l);
        count++;
      }
    }

    suggSec.style.display = query ? 'none' : '';
    ll.innerHTML = h;

    if (count === 0) { nores.removeAttribute('hidden'); noresQ.textContent = q; }
    else             { nores.setAttribute('hidden', ''); }
  }


  function syncUI() {
    var chips = document.querySelectorAll('#ls-sugg .ls-chip');
    for (var i = 0; i < chips.length; i++) {
      var s = chips[i].dataset.code === current;
      chips[i].classList.toggle('ls-sel', s);
      chips[i].setAttribute('aria-selected', String(s));
    }
    var items = document.querySelectorAll('#ls-ll .ls-li');
    for (var j = 0; j < items.length; j++) {
      var sj = items[j].dataset.code === current;
      items[j].classList.toggle('ls-sel', sj);
      items[j].setAttribute('aria-selected', String(sj));
    }
    var trig  = document.getElementById('ls-trigger');
    var label = document.getElementById('ls-trig-lbl');
    var tflag = document.getElementById('ls-trig-flag');
    if (tflag) tflag.innerHTML = flagMarkup(current, 'trig');
    if (current === ORIGINAL) {
      trig.classList.remove('ls-on');
      label.textContent = ORIGINAL.toUpperCase();
    } else {
      trig.classList.add('ls-on');
      label.textContent = current.split('-')[0].toUpperCase();
    }
    var reset = document.getElementById('ls-reset');
    if (current !== ORIGINAL) reset.removeAttribute('hidden');
    else reset.setAttribute('hidden', '');

    var notice = document.getElementById('ls-notice');
    var ntxt   = document.getElementById('ls-ntxt');
    var norig  = document.getElementById('ls-norig');
    var nundo  = document.getElementById('ls-undo');
    if (current !== ORIGINAL) {
      var lo = getLang(current);
      var native = lo ? lo.native : current;
      ntxt.innerHTML =
        'Viewing in <strong class="notranslate" translate="no">' +
        escapeHtml(native) +
        '</strong> — translated version';
      if (norig) {
        norig.textContent = 'View original';
        norig.setAttribute('aria-label', 'View original');
      }
      if (nundo) {
        if (undoFrom != null && undoFrom !== '') {
          nundo.removeAttribute('hidden');
          nundo.textContent = 'Previous language';
          nundo.setAttribute('aria-label', 'Go back to previous language');
        } else {
          nundo.setAttribute('hidden', '');
        }
      }
      notice.removeAttribute('hidden');
    } else {
      notice.setAttribute('hidden', '');
      if (norig) {
        norig.textContent = 'View original';
        norig.setAttribute('aria-label', 'View original');
      }
      if (nundo) nundo.setAttribute('hidden', '');
    }
  }


  function openPanel() {
    if (panelOpen) return;
    panelOpen = true;
    var panel = document.getElementById('ls-panel');
    var bd    = document.getElementById('ls-bd');
    panel.removeAttribute('hidden');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        panel.classList.add('ls-open');
        bd.classList.add('ls-open');
      });
    });
    document.getElementById('ls-trigger').setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      var inp = document.getElementById('ls-search');
      if (inp) inp.focus();
    }, 80);
    setTimeout(function () {
      var sel = document.querySelector('.ls-li.ls-sel,.ls-chip.ls-sel');
      if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 200);
  }

  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    var panel = document.getElementById('ls-panel');
    var bd    = document.getElementById('ls-bd');
    var trig  = document.getElementById('ls-trigger');
    panel.classList.remove('ls-open');
    bd.classList.remove('ls-open');
    trig.setAttribute('aria-expanded', 'false');
    setTimeout(function () { panel.setAttribute('hidden', ''); }, 240);
    var inp = document.getElementById('ls-search');
    var sc  = document.getElementById('ls-sc');
    if (inp && inp.value) { inp.value = ''; if (sc) sc.setAttribute('hidden', ''); buildList(''); }
    trig.focus();
  }


  function undoLanguage() {
    if (undoFrom == null || undoFrom === '') return;
    var target = undoFrom;
    undoFrom = null;
    /* Undo Canadian mode if active */
    if (current === 'en-CA') removeCanadianMode();
    current = target;
    writeStore(current);
    syncUI();
    if (target === 'en-CA') { applyCanadianMode(); }
    else { applyTranslation(target); }
  }

  /* ── Canadian English Easter-egg ── */
  var canadianActive = false;
  var canadianOriginals = [];

  var CA_REPLACEMENTS = [
    [/\bsorry\b/gi, 'sooorry'],
    [/\byou\b/gi, 'ya'],
    [/\babout\b/gi, 'aboot'],
    [/\bhouse\b/gi, 'hoose'],
    [/\btraffic\b/gi, 'traffic, eh'],
    [/\bdisruptions?\b/gi, function(m){ return m + ', sorry aboot that'; }],
    [/\bweather\b/gi, 'weather (probably snow)'],
    [/\bunderstand\b/gi, 'understand, eh'],
    [/\.\s*$/gm, ', eh.'],
  ];

  function applyCanadianMode() {
    if (canadianActive) return;
    canadianActive = true;
    canadianOriginals = [];
    var walker = document.createTreeWalker(
      document.querySelector('.landing') || document.body,
      NodeFilter.SHOW_TEXT,
      { acceptNode: function(n) {
          var p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest('.notranslate,[translate="no"],#ls-root,#ls-panel,#ls-notice,.brand-lockup,.header__nav')) return NodeFilter.FILTER_REJECT;
          if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
          return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    var node;
    while ((node = walker.nextNode())) {
      var orig = node.textContent;
      var text = orig;
      for (var i = 0; i < CA_REPLACEMENTS.length; i++) {
        text = text.replace(CA_REPLACEMENTS[i][0], CA_REPLACEMENTS[i][1]);
      }
      if (text !== orig) {
        canadianOriginals.push({ node: node, text: orig });
        node.textContent = text;
      }
    }
  }

  function removeCanadianMode() {
    if (!canadianActive) return;
    for (var i = 0; i < canadianOriginals.length; i++) {
      try { canadianOriginals[i].node.textContent = canadianOriginals[i].text; } catch(e) {}
    }
    canadianOriginals = [];
    canadianActive = false;
  }

  function selectLang(code) {
    var prev = current;
    if (code === prev) return;

    /* Undo Canadian mode when switching away */
    if (prev === 'en-CA') removeCanadianMode();

    undoFrom = prev;
    current = code;
    writeStore(code);
    syncUI();
    closePanel();

    if (code === 'en-CA') {
      /* Canadian English: don't call Google Translate, just canadianise the page */
      applyCanadianMode();
    } else {
      applyTranslation(code);
    }
  }


  function onListClick(e) {
    var t = e.target;
    while (t && !t.dataset.code) t = t.parentElement;
    if (t && t.dataset.code) selectLang(t.dataset.code);
  }

  function onArrow(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    var btns = Array.prototype.slice.call(e.currentTarget.querySelectorAll('button'));
    var idx  = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && idx < btns.length - 1) btns[idx + 1].focus();
    if (e.key === 'ArrowUp'   && idx > 0)               btns[idx - 1].focus();
  }

  function bindEvents() {
    var trig   = document.getElementById('ls-trigger');
    var xBtn   = document.getElementById('ls-close');
    var bd     = document.getElementById('ls-bd');
    var search = document.getElementById('ls-search');
    var sc     = document.getElementById('ls-sc');
    var reset  = document.getElementById('ls-reset');
    var norig  = document.getElementById('ls-norig');
    var nundo  = document.getElementById('ls-undo');
    var nclose = document.getElementById('ls-nclose');
    var panel  = document.getElementById('ls-panel');
    var sugg   = document.getElementById('ls-sugg');
    var ll     = document.getElementById('ls-ll');

    trig.addEventListener('click', function () { panelOpen ? closePanel() : openPanel(); });
    xBtn.addEventListener('click', closePanel);
    bd.addEventListener('click', closePanel);

    search.addEventListener('input', function () {
      var q = search.value;
      q ? sc.removeAttribute('hidden') : sc.setAttribute('hidden', '');
      buildList(q);
    });
    sc.addEventListener('click', function () {
      search.value = ''; sc.setAttribute('hidden', ''); buildList(''); search.focus();
    });

    reset.addEventListener('click', function () { selectLang(ORIGINAL); });
    norig.addEventListener('click', function () { selectLang(ORIGINAL); });
    if (nundo) nundo.addEventListener('click', undoLanguage);
    nclose.addEventListener('click', function () {
      document.getElementById('ls-notice').setAttribute('hidden', '');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panelOpen) { e.preventDefault(); closePanel(); }
    });

    
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var all = Array.prototype.slice.call(
        panel.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')
      ).filter(function (el) { return !el.hasAttribute('hidden') && el.offsetParent !== null; });
      if (!all.length) return;
      var first = all[0], last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first)  { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    sugg.addEventListener('click', onListClick);
    sugg.addEventListener('keydown', onArrow);
    ll.addEventListener('click', onListClick);
    ll.addEventListener('keydown', onArrow);
  }


  function restoreLang() {
    var cookie = getCookie('googtrans');
    if (cookie && cookie.indexOf('/en/') === 0) {
      var code = cookie.slice(4);
      if (code && code !== ORIGINAL) { current = code; writeStore(code); syncUI(); return; }
    }
    var saved = readStore();
    if (saved && saved !== ORIGINAL) {
      current = saved;
      syncUI();
      if (saved === 'en-CA') applyCanadianMode();
    }
  }


  function init() {
    ensureFlagIconsCss();
    injectStyles();
    buildDOM();
    buildSuggested();
    buildList('');
    bindEvents();
    restoreLang();
    syncUI();
    loadGoogleTranslate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
