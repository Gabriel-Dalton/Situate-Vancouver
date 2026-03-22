
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

  var FLAGS = {
    'af':'🇿🇦','sq':'🇦🇱','am':'🇪🇹','ar':'🇸🇦','hy':'🇦🇲','az':'🇦🇿','eu':'🌐',
    'be':'🇧🇾','bn':'🇧🇩','bs':'🇧🇦','bg':'🇧🇬','ca':'🌐','zh-CN':'🇨🇳',
    'zh-TW':'🇹🇼','hr':'🇭🇷','cs':'🇨🇿','da':'🇩🇰','nl':'🇳🇱','en':'🇬🇧',
    'et':'🇪🇪','fi':'🇫🇮','fr':'🇫🇷','gl':'🌐','ka':'🇬🇪','de':'🇩🇪','el':'🇬🇷',
    'gu':'🇮🇳','ht':'🇭🇹','ha':'🇳🇬','he':'🇮🇱','hi':'🇮🇳','hu':'🇭🇺','is':'🇮🇸',
    'ig':'🇳🇬','id':'🇮🇩','ga':'🇮🇪','it':'🇮🇹','ja':'🇯🇵','kn':'🇮🇳','kk':'🇰🇿',
    'km':'🇰🇭','ko':'🇰🇷','lo':'🇱🇦','lv':'🇱🇻','lt':'🇱🇹','lb':'🇱🇺','mk':'🇲🇰',
    'ms':'🇲🇾','ml':'🇮🇳','mt':'🇲🇹','mi':'🇳🇿','mr':'🇮🇳','mn':'🇲🇳','my':'🇲🇲',
    'ne':'🇳🇵','no':'🇳🇴','fa':'🇮🇷','pl':'🇵🇱','pt':'🇵🇹','pa':'🇮🇳','ro':'🇷🇴',
    'ru':'🇷🇺','sr':'🇷🇸','si':'🇱🇰','sk':'🇸🇰','sl':'🇸🇮','so':'🇸🇴','es':'🇪🇸',
    'sw':'🇰🇪','sv':'🇸🇪','tl':'🇵🇭','ta':'🇮🇳','te':'🇮🇳','th':'🇹🇭','tr':'🇹🇷',
    'uk':'🇺🇦','ur':'🇵🇰','uz':'🇺🇿','vi':'🇻🇳','cy':'🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'xh':'🇿🇦','yi':'🌐','yo':'🇳🇬','zu':'🇿🇦',
  };

  var SUGGESTED = ['es','fr','de','zh-CN','ja','ar','pt','hi','ru','ko'];
  var ORIGINAL  = 'en';
  var STORE_KEY = 'ls_selected_lang';


  var current   = ORIGINAL;
  var panelOpen = false;


  function getLang(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return null;
  }

  function getFlag(code) { return FLAGS[code] || '🌐'; }

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
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }


  function injectStyles() {
    var el = document.createElement('style');
    el.id = 'ls-styles';
    
    el.textContent =
      
      '#ls-root{' +
        '--lsa:#c44d2a;--lsah:#a33f22;--lsas:rgba(196,77,42,.09);--lsah2:rgba(196,77,42,.15);' +
        '--lsbg:#f8f6f3;--lssf:#fff;--lsbd:#e5e2de;' +
        '--lst:#1a1a1a;--lst2:#4a4a4a;--lstm:#6b6b6b;' +
        '--lsr:14px;--lsrsm:10px;' +
        '--lssh:0 16px 48px rgba(0,0,0,.14),0 2px 8px rgba(0,0,0,.06);' +
        '--lse:cubic-bezier(.4,0,.2,1);--lsd:.22s;' +
        '--lsf:"Work Sans",system-ui,sans-serif;' +
        '--lsfh:"Fredoka",system-ui,sans-serif;' +
      '}' +

      
      '#ls-trigger{' +
        'position:fixed;top:60px;right:12px;z-index:9990;' +
        'display:flex;align-items:center;gap:7px;' +
        'padding:11px 18px 11px 13px;' +
        'background:var(--lssf);border:1.5px solid var(--lsbd);border-radius:100px;' +
        'font-family:var(--lsf);font-size:.875rem;font-weight:600;color:var(--lst);' +
        'cursor:pointer;white-space:nowrap;' +
        'box-shadow:0 4px 20px rgba(196,77,42,.18),0 1px 4px rgba(0,0,0,.07);' +
        'transition:transform var(--lsd) var(--lse),box-shadow var(--lsd) var(--lse),' +
          'border-color var(--lsd) var(--lse),background var(--lsd) var(--lse),color var(--lsd) var(--lse);' +
        '-webkit-tap-highlight-color:transparent;outline:none;' +
      '}' +
      '#ls-trigger:hover{' +
        'border-color:var(--lsa);transform:translateY(-1px);' +
        'box-shadow:0 8px 28px rgba(196,77,42,.26),0 1px 4px rgba(0,0,0,.06);' +
      '}' +
      '#ls-trigger:focus-visible{outline:2.5px solid var(--lsa);outline-offset:3px}' +
      '#ls-trigger:active{transform:translateY(0)}' +
      '#ls-trigger.ls-on{background:var(--lsa);border-color:var(--lsa);color:#fff;' +
        'box-shadow:0 4px 20px rgba(196,77,42,.36)}' +
      '#ls-trigger.ls-on:hover{background:var(--lsah);border-color:var(--lsah)}' +
      '.ls-trig-icon{width:17px;height:17px;flex-shrink:0;stroke:currentColor;fill:none;' +
        'stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}' +
      '#ls-trig-lbl{font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}' +

      
      '#ls-bd{' +
        'position:fixed;inset:0;z-index:9991;' +
        'background:rgba(10,8,6,.38);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);' +
        'opacity:0;visibility:hidden;pointer-events:none;' +
        'transition:opacity var(--lsd) var(--lse),visibility var(--lsd) var(--lse);' +
      '}' +
      '#ls-bd.ls-open{opacity:1;visibility:visible;pointer-events:auto}' +

      
      '#ls-panel{' +
        'position:fixed;z-index:9992;' +
        'background:var(--lssf);border:1px solid var(--lsbd);' +
        'border-radius:var(--lsr);box-shadow:var(--lssh);' +
        'width:min(520px,calc(100vw - 32px));' +
        'max-height:min(640px,calc(100dvh - 48px));' +
        'display:flex;flex-direction:column;overflow:hidden;' +
        'opacity:0;visibility:hidden;pointer-events:none;' +
        'transform:translate(-50%,-50%) translateY(-8px) scale(.97);transform-origin:center center;' +
        'transition:opacity var(--lsd) var(--lse),transform var(--lsd) var(--lse),visibility var(--lsd) var(--lse);' +
        'top:50%;left:50%;' +
      '}' +
      '#ls-panel.ls-open{opacity:1;visibility:visible;transform:translate(-50%,-50%) scale(1);pointer-events:auto}' +
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
      '#ls-search:focus{border-color:var(--lsa);background:var(--lssf);box-shadow:0 0 0 3.5px rgba(196,77,42,.1)}' +
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

      
      '.ls-sg{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:2px}' +
      '.ls-chip{display:flex;align-items:center;gap:8px;padding:9px 11px;' +
        'border:1.5px solid var(--lsbd);border-radius:var(--lsrsm);' +
        'background:transparent;font-family:var(--lsf);cursor:pointer;' +
        'text-align:left;width:100%;' +
        'transition:border-color var(--lsd) var(--lse),background var(--lsd) var(--lse),box-shadow var(--lsd) var(--lse);' +
        '-webkit-tap-highlight-color:transparent;outline:none}' +
      '.ls-chip:hover{border-color:var(--lsa);background:var(--lsas)}' +
      '.ls-chip:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '.ls-chip.ls-sel{border-color:var(--lsa);background:var(--lsas);box-shadow:0 0 0 1px var(--lsa)}' +
      '.ls-cf{font-size:1.1rem;line-height:1;flex-shrink:0}' +
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
      '.ls-lf{font-size:1.3rem;line-height:1;flex-shrink:0;width:26px;text-align:center}' +
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
        'background:var(--lsas);border:1px solid rgba(196,77,42,.2);' +
        'border-radius:6px;padding:5px 12px;cursor:pointer;white-space:nowrap;' +
        'transition:background var(--lsd) var(--lse);-webkit-tap-highlight-color:transparent;outline:none}' +
      '#ls-norig:hover{background:var(--lsah2)}' +
      '#ls-norig:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '#ls-nclose{display:flex;align-items:center;justify-content:center;' +
        'width:26px;height:26px;border-radius:6px;border:none;' +
        'background:transparent;color:var(--lstm);cursor:pointer;flex-shrink:0;padding:0;' +
        'transition:background var(--lsd) var(--lse);-webkit-tap-highlight-color:transparent;outline:none}' +
      '#ls-nclose:hover{background:var(--lsbg)}' +
      '#ls-nclose:focus-visible{outline:2px solid var(--lsa);outline-offset:2px}' +
      '#ls-nclose svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round}' +

      
      '@media(max-width:768px){' +
        '#ls-panel{position:fixed;bottom:0;left:0;right:0;top:auto;' +
          'width:100%;max-width:100%;' +
          'border-radius:18px 18px 0 0;transform-origin:bottom center;' +
          'max-height:85dvh;' +
          'transform:translateY(32px) scale(.98)}' +
        '#ls-panel.ls-open{transform:translateY(0) scale(1)}' +
      '}' +
      '@media(max-width:540px){' +
        '#ls-trigger{top:56px;right:8px;padding:10px 14px 10px 12px}' +
        '#ls-panel{max-height:82dvh}' +
        '.ls-ni{flex-wrap:wrap;gap:7px}' +
        '#ls-ntxt{flex-basis:100%}' +
        '#ls-norig{margin-left:auto}' +
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
    root.innerHTML =
      '<div id="ls-gt-el" aria-hidden="true" style="display:none;position:absolute"></div>' +

      
      '<div id="ls-notice" role="status" aria-live="polite" hidden>' +
        '<div class="ls-ni">' +
          S.globeNi +
          '<span id="ls-ntxt">Viewing a translated version</span>' +
          '<button id="ls-norig" type="button">View original</button>' +
          '<button id="ls-nclose" type="button" aria-label="Dismiss notice">' + S.x + '</button>' +
        '</div>' +
      '</div>' +

      
      '<button id="ls-trigger" type="button" ' +
          'aria-label="Select language" aria-expanded="false" aria-controls="ls-panel">' +
        S.globe +
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

    document.body.appendChild(root);

    
    var discLink = document.getElementById('ls-disc-link');
    if (discLink) {
      var inDev = /\/_dev\//.test(location.pathname) || /\/_dev\//.test(location.href);
      discLink.href = inDev ? 'disclaimers.html#language-translations' : '_dev/disclaimers.html#language-translations';
    }
  }


  function chipHTML(l) {
    var s = current === l.code;
    return '<button type="button" class="ls-chip' + (s ? ' ls-sel' : '') +
      '" data-code="' + l.code + '" role="option" aria-selected="' + s + '" aria-label="' + l.name + '">' +
      '<span class="ls-cf" aria-hidden="true">' + getFlag(l.code) + '</span>' +
      '<span class="ls-ct"><span class="ls-cn">' + l.name + '</span>' +
      '<span class="ls-cv">' + l.native + '</span></span>' +
      '<span class="ls-ck" aria-hidden="true">' + S.check + '</span></button>';
  }

  function itemHTML(l) {
    var s = current === l.code;
    return '<button type="button" class="ls-li' + (s ? ' ls-sel' : '') +
      '" data-code="' + l.code + '" role="option" aria-selected="' + s + '">' +
      '<span class="ls-lf" aria-hidden="true">' + getFlag(l.code) + '</span>' +
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
    if (current !== ORIGINAL) {
      var lo = getLang(current);
      ntxt.innerHTML = 'Viewing in <strong>' + (lo ? lo.name : current) + '</strong> — translated version';
      notice.removeAttribute('hidden');
    } else {
      notice.setAttribute('hidden', '');
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


  function selectLang(code) {
    var prev = current;
    current = code;
    writeStore(code);
    syncUI();
    closePanel();
    if (code !== prev) applyTranslation(code);
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
    if (saved && saved !== ORIGINAL) { current = saved; syncUI(); }
  }


  function init() {
    injectStyles();
    buildDOM();
    buildSuggested();
    buildList('');
    bindEvents();
    restoreLang();
    loadGoogleTranslate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
