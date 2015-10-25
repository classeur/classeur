angular.module('classeur.extensions.mathJax', [])
	.directive('clMathJax',
		function($window, clEditorSvc) {
			var config, mathJaxScript;

			clEditorSvc.onMarkdownInit(2, function(markdown) {
				if (config) {
					markdown.inline.ruler.before('escape', 'math', math);
					markdown.inline.ruler.push('texMath', texMath);
					markdown.renderer.rules.math = function(tokens, idx) {
						return escapeHtml(tokens[idx].math);
					};
					markdown.renderer.rules.inlineMath = function(tokens, idx) {
						return '\\(' + escapeHtml(tokens[idx].math) + '\\)';
					};
					markdown.renderer.rules.displayMath = function(tokens, idx) {
						return '\\[' + escapeHtml(tokens[idx].math) + '\\]';
					};
					!mathJaxScript && initMathJax();
					clEditorSvc.onAsyncPreview(function(cb) {
						if (!updateMathJax) {
							return cb();
						}
						typesetCallback = cb;
						updateMathJax();
					});
				}

				clEditorSvc.setPrismOptions({
					maths: !!config
				});
			});

			function escapeHtml(html) {
				return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}

			function math(state, silent) {
				var startMathPos = state.pos;
				if (state.src.charCodeAt(startMathPos) !== 0x5C /* \ */ ) {
					return false;
				}
				var match = state.src.slice(++startMathPos).match(/^(?:\\\[|\\\(|begin\{([^}]*)\})/);
				if (!match) {
					return false;
				}
				startMathPos += match[0].length;
				var type, endMarker;
				if (match[0] === '\\[') {
					type = 'displayMath';
					endMarker = '\\\\]';
				} else if (match[0] === '\\(') {
					type = 'inlineMath';
					endMarker = '\\\\)';
				} else if (match[1]) {
					type = 'math';
					endMarker = '\\end{' + match[1] + '}';
				}
				var endMarkerPos = state.src.indexOf(endMarker, startMathPos);
				if (endMarkerPos === -1) {
					return false;
				}
				var nextPos = endMarkerPos + endMarker.length;
				if (!silent) {
					var token = state.push(type);
					token.math = type === 'math' ?
						state.src.slice(state.pos, nextPos) : state.src.slice(startMathPos, endMarkerPos);
				}
				state.pos = nextPos;
				return true;
			}

			function texMath(state, silent) {
				var startMathPos = state.pos;
				if (state.src.charCodeAt(startMathPos) !== 0x24 /* $ */ ) {
					return false;
				}

				// Parse tex math according to http://pandoc.org/README.html#math
				var endMarker = '$';
				var afterStartMarker = state.src.charCodeAt(++startMathPos);
				if (afterStartMarker === 0x24 /* $ */ ) {
					endMarker = '$$';
					if (state.src.charCodeAt(++startMathPos) === 0x24 /* $ */ ) {
						// 3 markers are too much
						return false;
					}
				} else {
					// Skip if opening $ is succeeded by a space character
					if (afterStartMarker === 0x20 /* space */ || afterStartMarker === 0x09 /* \t */ || afterStartMarker === 0x0a /* \n */ ) {
						return false;
					}
				}
				var endMarkerPos = state.src.indexOf(endMarker, startMathPos);
				if (endMarkerPos === -1) {
					return false;
				}
				if (state.src.charCodeAt(endMarkerPos - 1) === 0x5C /* \ */ ) {
					return false;
				}
				var nextPos = endMarkerPos + endMarker.length;
				if (endMarker.length === 1) {
					// Skip if $ is preceded by a space character
					var beforeEndMarker = state.src.charCodeAt(endMarkerPos - 1);
					if (beforeEndMarker === 0x20 /* space */ || beforeEndMarker === 0x09 /* \t */ || beforeEndMarker === 0x0a /* \n */ ) {
						return false;
					}
					// Skip if closing $ is succeeded by a digit (eg $5 $10 ...)
					var suffix = state.src.charCodeAt(nextPos);
					if (suffix >= 0x30 && suffix < 0x3A) {
						return false;
					}
				}
				
				if (!silent) {
					var token = state.push(endMarker.length === 1 ? 'inlineMath' : 'displayMath');
					token.math = state.src.slice(startMathPos, endMarkerPos);
				}
				state.pos = nextPos;
				return true;
			}

			function initMathJax() {
				mathJaxScript = document.createElement('script');
				mathJaxScript.src = 'https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML&delayStartupUntil=configured';
				mathJaxScript.onload = onMathJaxLoaded;
				mathJaxScript.onerror = function() {
					mathJaxScript = undefined;
				};
				document.head.appendChild(mathJaxScript);
			}

			var typesetCallback, updateMathJax;
			var ready = false,
				pending = false;

			function applyConfig() {
				if (!config || !$window.MathJax) {
					return;
				}
				$window.MathJax.Hub.Config(JSON.parse(JSON.stringify(config)));
				$window.MathJax.Hub.Configured();
			}

			function onMathJaxLoaded() {
				var MathJax = $window.MathJax;
				var HUB = $window.MathJax.Hub;
				applyConfig();

				//
				//  This is run to restart MathJax after it has finished
				//    the previous run (that may have been canceled)
				//
				function RestartMJ() {
					pending = false;
					HUB.cancelTypeset = false;
					HUB.Queue([
						"Typeset",
						HUB
					]);
					HUB.Queue(typesetCallback); //benweet
				}

				//
				//  When the preview changes, cancel MathJax and restart,
				//    if we haven't done that already.
				//
				updateMathJax = function() {
					if (!pending /*benweet (we need to call our afterRefreshCallback) && ready */ ) {
						pending = true;
						HUB.Cancel();
						HUB.Queue(RestartMJ);
					}
				};

				//
				//  Runs after initial typeset
				//
				HUB.Queue(function() {
					ready = true;
					HUB.processUpdateTime = 50;
					HUB.Config({
						"HTML-CSS": {
							EqnChunk: 10,
							EqnChunkFactor: 1
						},
						SVG: {
							EqnChunk: 10,
							EqnChunkFactor: 1
						}
					});
				});

				if (!HUB.Cancel) {
					HUB.cancelTypeset = false;
					HUB.Register.StartupHook("HTML-CSS Jax Config", function() {
						var HTMLCSS = MathJax.OutputJax["HTML-CSS"],
							TRANSLATE = HTMLCSS.Translate;
						HTMLCSS.Augment({
							Translate: function(script, state) {
								if (HUB.cancelTypeset || state.cancelled)
									throw Error("MathJax Canceled");
								return TRANSLATE.call(HTMLCSS, script, state);
							}
						});
					});
					HUB.Register.StartupHook("SVG Jax Config", function() {
						var SVG = MathJax.OutputJax.SVG,
							TRANSLATE = SVG.Translate;
						SVG.Augment({
							Translate: function(script, state) {
								if (HUB.cancelTypeset || state.cancelled)
									throw Error("MathJax Canceled");
								return TRANSLATE.call(SVG,
									script, state);
							}
						});
					});
					HUB.Register.StartupHook("TeX Jax Config", function() {
						var TEX = MathJax.InputJax.TeX,
							TRANSLATE = TEX.Translate;
						TEX.Augment({
							Translate: function(script, state) {
								if (HUB.cancelTypeset || state.cancelled)
									throw Error("MathJax Canceled");
								return TRANSLATE.call(TEX, script, state);
							}
						});
					});
					var PROCESSERROR = HUB.processError;
					HUB.processError = function(error, state, type) {
						if ("MathJax Canceled" !== error.message)
							return PROCESSERROR.call(HUB, error, state, type);
						MathJax.Message.Clear(0, 0);
						state.jaxIDs = [];
						state.jax = {};
						state.scripts = [];
						state.i = state.j = 0;
						state.cancelled = true;
						return null;
					};
					HUB.Cancel = function() {
						this.cancelTypeset = true;
					};
				}
			}

			return {
				restrict: 'A',
				link: link
			};

			function link(scope) {
				function checkConfig() {
					var fileProperties = scope.currentFileDao.contentDao.properties;

					var newConfig = fileProperties['ext:mathjax'] !== 'false' ? (function() {
						var tex2jax, tex;
						try {
							tex2jax = JSON.parse(fileProperties['ext:mathjax:tex2jax']);
						} catch (e) {}
						try {
							tex = JSON.parse(fileProperties['ext:mathjax:tex']);
						} catch (e) {}

						return {
							"HTML-CSS": {
								preferredFont: "TeX",
								availableFonts: [
									"TeX"
								],
								linebreaks: {
									automatic: true
								},
								EqnChunk: 10,
								imageFont: null
							},
							tex2jax: ({
								inlineMath: [
									[
										"\\(",
										"\\)"
									]
								],
								displayMath: [
									[
										"\\[",
										"\\]"
									]
								],
								processEscapes: true
							}).cl_extend(tex2jax),
							TeX: ({
								noUndefined: {
									attributes: {
										mathcolor: "red",
										mathbackground: "#FFEEEE",
										mathsize: "90%"
									}
								},
								Safe: {
									allow: {
										URLs: "safe",
										classes: "safe",
										cssIDs: "safe",
										styles: "safe",
										fontsize: "all"
									}
								}
							}).cl_extend(tex),
							messageStyle: "none"
						};
					})() : undefined;
					if (JSON.stringify(newConfig) !== JSON.stringify(config)) {
						config = newConfig;
						applyConfig();
						return true;
					}
				}

				checkConfig();
				scope.$watch('currentFileDao.contentDao.properties', function(properties) {
					if (properties && checkConfig()) {
						clEditorSvc.initConverter();
					}
				});
			}
		});
