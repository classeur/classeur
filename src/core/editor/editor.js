angular.module('classeur.core.editor', [])
	.directive('clEditor',
		function($window, $$sanitizeUri, clEditorSvc, clEditorLayoutSvc, clSettingSvc) {
			return {
				restrict: 'E',
				templateUrl: 'core/editor/editor.html',
				link: link
			};

			function link(scope, element) {
				var containerElt = element[0].querySelector('.editor.container');
				var editorElt = element[0].querySelector('.editor.content');
				clEditorSvc.setCurrentFileDao(scope.currentFileDao);
				clEditorSvc.initConverter();
				clEditorSvc.setEditorElt(editorElt);
				clEditorSvc.pagedownEditor.hooks.set('insertLinkDialog', function(callback) {
					clEditorSvc.linkDialogCallback = callback;
					clEditorLayoutSvc.currentControl = 'linkDialog';
					scope.$evalAsync();
					return true;
				});
				clEditorSvc.pagedownEditor.hooks.set('insertImageDialog', function(callback) {
					clEditorSvc.imageDialogCallback = callback;
					clEditorLayoutSvc.currentControl = 'imageDialog';
					scope.$evalAsync();
					return true;
				});

				var state;
				scope.$on('$destroy', function() {
					state = 'destroyed';
				});

				function checkState() {
					return state === 'destroyed';
				}

				function saveState() {
					scope.currentFileDao.contentDao.state = {
						selectionStart: clEditorSvc.cledit.selectionMgr.selectionStart,
						selectionEnd: clEditorSvc.cledit.selectionMgr.selectionEnd,
						scrollTop: containerElt.scrollTop,
					};
				}
				containerElt.addEventListener('scroll', saveState);

				var newSectionList, newSelectionRange;
				var debouncedEditorChanged = $window.cledit.Utils.debounce(function() {
					if (checkState()) {
						return;
					}
					if (clEditorSvc.sectionList !== newSectionList) {
						clEditorSvc.sectionList = newSectionList;
						state ? debouncedRefreshPreview() : refreshPreview();
					}
					clEditorSvc.selectionRange = newSelectionRange;
					scope.currentFileDao.contentDao.text = clEditorSvc.cledit.getContent();
					saveState();
					clEditorSvc.lastContentChange = Date.now();
					scope.$apply();
				}, 10);

				function refreshPreview() {
					state = 'ready';
					clEditorSvc.convert();
					setTimeout(clEditorSvc.refreshPreview, 10);
				}

				var debouncedRefreshPreview = $window.cledit.Utils.debounce(function() {
					if (checkState()) {
						return;
					}
					refreshPreview();
					scope.$apply();
				}, 20);

				clEditorSvc.cledit.on('contentChanged', function(content, sectionList) {
					newSectionList = sectionList;
					debouncedEditorChanged();
				});

				clEditorSvc.cledit.selectionMgr.on('selectionChanged', function(start, end, selectionRange) {
					newSelectionRange = selectionRange;
					debouncedEditorChanged();
				});

				if (clSettingSvc.values.editorInlineImg) {
					clEditorSvc.cledit.highlighter.on('sectionHighlighted', function(section) {
						section.elt.getElementsByClassName('token img').cl_each(function(imgTokenElt) {
							var srcElt = imgTokenElt.querySelector('.token.cl-src');
							if (srcElt) {
								var imgElt = $window.document.createElement('img');
								imgElt.style.display = 'none';
								var uri = srcElt.textContent;
								if (!/^unsafe/.test($$sanitizeUri(uri, true))) {
									imgElt.onload = function() {
										imgElt.style.display = '';
									};
									imgElt.src = uri;
								}
								imgTokenElt.insertBefore(imgElt, imgTokenElt.firstChild);
							}
						});
					});
				}

				var isInited;
				scope.$watch('editorSvc.options', function(options) {
					clEditorSvc.forcePreviewRefresh();
					options = ({}).cl_extend(options);
					if (!isInited) {
						options.content = scope.currentFileDao.contentDao.text;
						['selectionStart', 'selectionEnd', 'scrollTop'].cl_each(function(key) {
							options[key] = scope.currentFileDao.contentDao.state[key];
						});
						isInited = true;
					}
					clEditorSvc.initCledit(options);
				});
				scope.$watch('editorLayoutSvc.isEditorOpen', function(isOpen) {
					clEditorSvc.cledit.toggleEditable(isOpen);
				});


				function onPreviewRefreshed(refreshed) {
					(refreshed && !clEditorSvc.lastSectionMeasured) ?
					clEditorSvc.measureSectionDimensions():
						debouncedMeasureSectionDimension();
				}

				var debouncedMeasureSectionDimension = $window.cledit.Utils.debounce(function() {
					if (checkState()) {
						return;
					}
					clEditorSvc.measureSectionDimensions();
					scope.$apply();
				}, 500);
				scope.$watch('editorSvc.lastPreviewRefreshed', onPreviewRefreshed);
				scope.$watch('editorSvc.editorSize()', debouncedMeasureSectionDimension);
				scope.$watch('editorSvc.previewSize()', debouncedMeasureSectionDimension);
				scope.$watch('editorLayoutSvc.isPreviewVisible', function(isVisible) {
					isVisible && state && clEditorSvc.measureSectionDimensions();
				});
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					!currentControl && setTimeout(function() {
						!scope.isDialogOpen && clEditorSvc.cledit && clEditorSvc.cledit.focus();
					}, 1);
				});
			}
		})
	.directive('clPreview',
		function($window, clEditorSvc, clConfig) {
			var appUri = clConfig.appUri || '';

			return {
				restrict: 'E',
				templateUrl: 'core/editor/preview.html',
				link: link
			};

			function link(scope, element) {
				clEditorSvc.setPreviewElt(element[0].querySelector('.preview.content'));
				var containerElt = element[0].querySelector('.preview.container');
				clEditorSvc.isPreviewTop = containerElt.scrollTop < 10;
				containerElt.addEventListener('scroll', function() {
					var isPreviewTop = containerElt.scrollTop < 10;
					if (isPreviewTop !== clEditorSvc.isPreviewTop) {
						clEditorSvc.isPreviewTop = isPreviewTop;
						scope.$apply();
					}
				});
				containerElt.addEventListener('click', function(evt) {
					var elt = evt.target;
					while (elt !== containerElt) {
						if (elt.href) {
							if (elt.href.match(/^https?:\/\//) && elt.href.slice(0, appUri.length) !== appUri) {
								evt.preventDefault();
								var wnd = window.open(elt.href, '_blank');
								return wnd.focus();
							}
						}
						elt = elt.parentNode;
					}
				});
			}
		})
	.directive('clToc',
		function(clEditorSvc) {
			return {
				restrict: 'E',
				template: '<div class="toc content no-select"></div>',
				link: link
			};

			function link(scope, element) {
				var tocElt = element[0].querySelector('.toc.content');
				clEditorSvc.setTocElt(tocElt);

				var isMousedown;
				var scrollerElt = tocElt;
				while (scrollerElt && scrollerElt.tagName !== 'MD-TAB-CONTENT') {
					scrollerElt = scrollerElt.parentNode;
				}

				function onClick(e) {
					if (!isMousedown) {
						return;
					}
					e.preventDefault();
					var y = e.clientY + scrollerElt.scrollTop;

					clEditorSvc.sectionDescList.cl_some(function(sectionDesc) {
						if (y < sectionDesc.tocDimension.endOffset) {
							var posInSection = (y - sectionDesc.tocDimension.startOffset) / (sectionDesc.tocDimension.height || 1);
							var editorScrollTop = sectionDesc.editorDimension.startOffset + sectionDesc.editorDimension.height * posInSection;
							clEditorSvc.editorElt.parentNode.scrollTop = editorScrollTop - clEditorSvc.scrollOffset;
							var previewScrollTop = sectionDesc.previewDimension.startOffset + sectionDesc.previewDimension.height * posInSection;
							clEditorSvc.previewElt.parentNode.scrollTop = previewScrollTop - clEditorSvc.scrollOffset;
							return true;
						}
					});
				}

				tocElt.addEventListener("mouseup", function() {
					isMousedown = false;
				});
				tocElt.addEventListener("mouseleave", function() {
					isMousedown = false;
				});
				tocElt.addEventListener("mousedown", function(e) {
					isMousedown = e.which === 1;
					onClick(e);
				});
				tocElt.addEventListener("mousemove", function(e) {
					onClick(e);
				});
			}
		})
	.factory('clEditorClassApplier',
		function($window, clEditorSvc, clRangeWrapper) {
			var nextTickCbs = [],
				savedSelection;
			var execNextTickCbs = $window.cledit.Utils.debounce(function() {
				while (nextTickCbs.length) {
					nextTickCbs.pop()();
				}
				savedSelection && clEditorSvc.cledit.selectionMgr.setSelectionStartEnd(savedSelection.start, savedSelection.end);
				savedSelection = undefined;
			});

			function nextTick(cb) {
				nextTickCbs.push(cb);
				execNextTickCbs();
			}

			function nextTickRestoreSelection() {
				savedSelection = {
					start: clEditorSvc.cledit.selectionMgr.selectionStart,
					end: clEditorSvc.cledit.selectionMgr.selectionEnd
				};
				execNextTickCbs();
			}

			function EditorClassApplier(classes, offsetGetter, properties) {
				classes = typeof classes === 'string' ? [classes] : classes;
				var lastEltCount,
					elts = clEditorSvc.editorElt.getElementsByClassName(classes[0]);

				function applyClass() {
					var offset = offsetGetter();
					if (!offset || offset.start === offset.end) {
						return;
					}
					var range = clEditorSvc.cledit.selectionMgr.createRange(
						Math.min(offset.start, offset.end),
						Math.max(offset.start, offset.end)
					);
					properties = properties || {};
					properties.className = classes.join(' ');
					clEditorSvc.cledit.watcher.noWatch(clRangeWrapper.wrap.cl_bind(clRangeWrapper, range, properties));
					clEditorSvc.cledit.selectionMgr.hasFocus && nextTickRestoreSelection();
					lastEltCount = elts.length;
				}

				function removeClass() {
					clEditorSvc.cledit.watcher.noWatch(clRangeWrapper.unwrap.cl_bind(clRangeWrapper, elts));
					clEditorSvc.cledit.selectionMgr.hasFocus && nextTickRestoreSelection();
				}

				function restoreClass() {
					if (elts.length !== lastEltCount) {
						removeClass();
						applyClass();
					}
				}

				this.stop = function() {
					clEditorSvc.cledit.off('contentChanged', restoreClass);
					nextTick(removeClass);
				};

				clEditorSvc.cledit.on('contentChanged', restoreClass);
				nextTick(applyClass);
			}

			return function(classes, offsetGetter, properties) {
				return new EditorClassApplier(classes, offsetGetter, properties);
			};
		})
	.factory('clPreviewClassApplier',
		function($window, clEditorSvc, clRangeWrapper) {
			function PreviewClassApplier(classes, offsetGetter, properties) {
				classes = typeof classes === 'string' ? [classes] : classes;
				var lastEltCount,
					elts = clEditorSvc.previewElt.getElementsByClassName(classes[0]),
					timeoutId;

				function applyClass() {
					timeoutId = undefined;
					var offset = offsetGetter();
					if (!offset || offset.start === offset.end) {
						return;
					}
					var start = $window.cledit.Utils.findContainer(clEditorSvc.previewElt, Math.min(offset.start, offset.end));
					var end = $window.cledit.Utils.findContainer(clEditorSvc.previewElt, Math.max(offset.start, offset.end));
					var range = $window.document.createRange();
					range.setStart(start.container, start.offsetInContainer);
					range.setEnd(end.container, end.offsetInContainer);
					properties = properties || {};
					properties.className = classes.join(' ');
					clRangeWrapper.wrap(range, properties);
					lastEltCount = elts.length;
				}

				this.remove = function() {
					clearTimeout(timeoutId);
					clRangeWrapper.unwrap(elts);
				};

				this.restore = function() {
					if (!timeoutId && elts.length !== lastEltCount) {
						this.remove();
						applyClass();
					}
				};

				timeoutId = setTimeout(applyClass, 10); // To come after the clEditorClassApplier
			}

			return function(classes, offsetGetter, properties) {
				return new PreviewClassApplier(classes, offsetGetter, properties);
			};
		})
	.filter('clHighlightMarkdown',
		function($window, $sce, clEditorSvc) {
			var defaultGrammar = window.mdGrammar({
				fences: true,
				tables: true,
				footnotes: true,
				abbrs: true,
				deflists: true,
				tocs: true,
				dels: true,
				subs: true,
				sups: true,
				maths: true,
				insideFences: clEditorSvc.insideFences
			});
			return function(value, grammar) {
				return $sce.trustAsHtml($window.Prism.highlight(value || '', grammar || defaultGrammar));
			};
		})
	.factory('clEditorSvc',
		function($window, $q, $rootScope, clSettingSvc, clEditorLayoutSvc, clHtmlSanitizer, clPagedown, clVersion) {

			// Create aliases for syntax highlighting
			var Prism = $window.Prism;
			({
				'js': 'javascript',
				'html': 'markup',
				'svg': 'markup',
				'xml': 'markup',
				'py': 'python',
				'rb': 'ruby',
				'ps1': 'powershell',
				'psm1': 'powershell'
			}).cl_each(function(name, alias) {
				Prism.languages[alias] = Prism.languages[name];
			});

			var insideFences = {};
			Prism.languages.cl_each(function(language, name) {
				if (Prism.util.type(language) === 'Object') {
					insideFences['language-' + name] = {
						pattern: new RegExp('`{3}' + name + '\\W[\\s\\S]*'),
						inside: {
							"cl cl-pre": /`{3}.*/,
							rest: language
						}
					};
				}
			});

			var noSpellcheckTokens = [
				'code',
				'pre',
				'pre gfm',
				'math block',
				'math inline',
				'math expr block',
				'math expr inline',
				'latex block',
			].cl_reduce(function(noSpellcheckTokens, key) {
				noSpellcheckTokens[key] = true;
				return noSpellcheckTokens;
			}, Object.create(null));
			Prism.hooks.add('wrap', function(env) {
				if (noSpellcheckTokens[env.type]) {
					env.attributes.spellcheck = 'false';
				}
			});

			var editorElt, previewElt, tocElt;
			var filenameSpaceElt, previewTextStartOffset;
			var prismOptions = {
				insideFences: insideFences
			};
			var forcePreviewRefresh = true;
			var markdownInitListeners = [];
			var asyncPreviewListeners = [];
			var currentFileDao;
			var startSectionBlockTypes = [
				'paragraph_open',
				'blockquote_open',
				'heading_open',
				'code',
				'fence',
				'table_open',
				'html_block',
				'bullet_list_open',
				'ordered_list_open',
				'hr',
				'dl_open',
				'toc',
			];
			var startSectionBlockTypeMap = startSectionBlockTypes.cl_reduce(function(map, type) {
				return (map[type] = true), map;
			}, Object.create(null));
			var htmlSectionMarker = '\uF111\uF222\uF333\uF444';
			var diffMatchPatch = new $window.diff_match_patch();
			var parsingCtx, conversionCtx;

			var clEditorSvc = {
				lastExternalChange: 0,
				scrollOffset: 80,
				insideFences: insideFences,
				options: {},
				setCurrentFileDao: function(fileDao) {
					currentFileDao = fileDao;
				},
				onMarkdownInit: function(priority, listener) {
					markdownInitListeners[priority] = listener;
				},
				initConverter: function() {
					clEditorSvc.markdown = new $window.markdownit('zero');

					// Let the markdownInitListeners add the rules
					clEditorSvc.markdown.core.ruler.enable([], true);
					clEditorSvc.markdown.block.ruler.enable([], true);
					clEditorSvc.markdown.inline.ruler.enable([], true);

					asyncPreviewListeners = [];
					markdownInitListeners.cl_each(function(listener) {
						listener(clEditorSvc.markdown);
					});
					startSectionBlockTypes.cl_each(function(type) {
						var rule = clEditorSvc.markdown.renderer.rules[type] || clEditorSvc.markdown.renderer.renderToken;
						clEditorSvc.markdown.renderer.rules[type] = function(tokens, idx) {
							if (tokens[idx].sectionDelimiter) {
								return htmlSectionMarker + rule.apply(clEditorSvc.markdown.renderer, arguments);
							}
							return rule.apply(clEditorSvc.markdown.renderer, arguments);
						};
					});
				},
				onAsyncPreview: function(listener) {
					asyncPreviewListeners.push(listener);
				},
				forcePreviewRefresh: function() {
					forcePreviewRefresh = true;
				},
				setPrismOptions: function(options) {
					prismOptions = prismOptions.cl_extend(options);
					this.prismGrammar = $window.mdGrammar(prismOptions);
					// Create new object to trigger watchers
					this.options = ({}).cl_extend(this.options);
					this.options.highlighter = function(text) {
						return Prism.highlight(text, clEditorSvc.prismGrammar);
					};
				},
				setPreviewElt: function(elt) {
					previewElt = elt;
					this.previewElt = elt;
					filenameSpaceElt = elt.querySelector('.filename.space');
				},
				setTocElt: function(elt) {
					tocElt = elt;
					this.tocElt = elt;
				},
				setEditorElt: function(elt) {
					editorElt = elt;
					this.editorElt = elt;
					parsingCtx = undefined;
					conversionCtx = undefined;
					clEditorSvc.sectionDescList = [];
					clEditorSvc.textToPreviewDiffs = undefined;
					clEditorSvc.cledit = $window.cledit(elt, elt.parentNode);
					clEditorSvc.cledit.on('contentChanged', function(content, sectionList) {
						parsingCtx.sectionList = sectionList;
					});
					clEditorSvc.pagedownEditor = clPagedown({
						input: Object.create(clEditorSvc.cledit)
					});
					clEditorSvc.pagedownEditor.run();
					editorElt.addEventListener('focus', function() {
						if (clEditorLayoutSvc.currentControl === 'menu') {
							clEditorLayoutSvc.currentControl = undefined;
						}
					});
				},
				initCledit: function(options) {
					options.sectionParser = function(text) {
						var markdownState = new clEditorSvc.markdown.core.State(text, clEditorSvc.markdown, {});
						var markdownCoreRules = clEditorSvc.markdown.core.ruler.getRules('');
						markdownCoreRules[0](markdownState); // Pass the normalize rule
						markdownCoreRules[1](markdownState); // Pass the block rule
						var lines = text.split('\n');
						lines.pop(); // Assume last char is a '\n'
						var sections = [],
							i = 0;
						parsingCtx = {
							markdownState: markdownState,
							markdownCoreRules: markdownCoreRules
						};

						function addSection(maxLine) {
							var section = '';
							for (; i < maxLine; i++) {
								section += lines[i] + '\n';
							}
							section && sections.push(section);
						}
						markdownState.tokens.cl_each(function(token) {
							if (token.level === 0 && startSectionBlockTypeMap[token.type]) {
								token.sectionDelimiter = true;
								addSection(token.map[0]);
							}
						});
						addSection(lines.length);
						return sections;
					};
					clEditorSvc.cledit.init(options);
				},
				setContent: function(content, isExternal) {
					if (clEditorSvc.cledit) {
						if (isExternal) {
							clEditorSvc.lastExternalChange = Date.now();
						}
						return clEditorSvc.cledit.setContent(content, isExternal);
					}
				},
				editorSize: function() {
					return editorElt.clientWidth + 'x' + editorElt.clientHeight;
				},
				previewSize: function() {
					return previewElt.clientWidth + 'x' + previewElt.clientHeight;
				}
			};

			function hashArray(arr, valueHash, valueArray) {
				var hash = [];
				arr.cl_each(function(str) {
					var strHash = valueHash[str];
					if (strHash === undefined) {
						strHash = valueArray.length;
						valueArray.push(str);
						valueHash[str] = strHash;
					}
					hash.push(strHash);
				});
				return String.fromCharCode.apply(null, hash);
			}

			clEditorSvc.convert = function() {
				if (!parsingCtx.markdownState.isConverted) { // Convert can be called twice without editor modification
					parsingCtx.markdownCoreRules.slice(2).cl_each(function(rule) { // Skip previously passed rules
						rule(parsingCtx.markdownState);
					});
					parsingCtx.markdownState.isConverted = true;
				}
				var html = clEditorSvc.markdown.renderer.render(
					parsingCtx.markdownState.tokens,
					clEditorSvc.markdown.options,
					parsingCtx.markdownState.env
				);
				var htmlSectionList = html.split(htmlSectionMarker);
				htmlSectionList[0] === '' && htmlSectionList.shift();
				var valueHash = Object.create(null),
					valueArray = [];
				var newSectionHash = hashArray(htmlSectionList, valueHash, valueArray);
				var htmlSectionDiff = [
					[1, newSectionHash]
				];
				if (conversionCtx) {
					var oldSectionHash = hashArray(conversionCtx.htmlSectionList, valueHash, valueArray);
					htmlSectionDiff = diffMatchPatch.diff_main(oldSectionHash, newSectionHash);
				}
				conversionCtx = {
					sectionList: parsingCtx.sectionList,
					htmlSectionList: htmlSectionList,
					htmlSectionDiff: htmlSectionDiff
				};
				clEditorSvc.lastConversion = Date.now();
			};

			var anchorHash = {};

			clEditorSvc.refreshPreview = function() {
				var newSectionDescList = [];
				var sectionPreviewElt, sectionTocElt;
				var sectionIdx = 0,
					sectionDescIdx = 0;
				var insertBeforePreviewElt = filenameSpaceElt.nextSibling,
					insertBeforeTocElt = tocElt.firstChild;
				conversionCtx.htmlSectionDiff.cl_each(function(item) {
					for (var i = 0; i < item[1].length; i++) {
						var section = conversionCtx.sectionList[sectionIdx];
						if (item[0] === 0) {
							var sectionDesc = clEditorSvc.sectionDescList[sectionDescIdx++];
							sectionDesc.editorElt = section.elt;
							newSectionDescList.push(sectionDesc);
							sectionIdx++;
							insertBeforePreviewElt.classList.remove('modified');
							insertBeforePreviewElt = insertBeforePreviewElt.nextSibling;
							insertBeforeTocElt.classList.remove('modified');
							insertBeforeTocElt = insertBeforeTocElt.nextSibling;
						} else if (item[0] === -1) {
							sectionDescIdx++;
							sectionPreviewElt = insertBeforePreviewElt;
							insertBeforePreviewElt = insertBeforePreviewElt.nextSibling;
							previewElt.removeChild(sectionPreviewElt);
							sectionTocElt = insertBeforeTocElt;
							insertBeforeTocElt = insertBeforeTocElt.nextSibling;
							tocElt.removeChild(sectionTocElt);
						} else if (item[0] === 1) {
							var html = conversionCtx.htmlSectionList[sectionIdx++];

							// Create preview section element
							sectionPreviewElt = document.createElement('div');
							sectionPreviewElt.className = 'cl-preview-section modified';
							sectionPreviewElt.innerHTML = clHtmlSanitizer(html);
							if (insertBeforePreviewElt) {
								previewElt.insertBefore(sectionPreviewElt, insertBeforePreviewElt);
							} else {
								previewElt.appendChild(sectionPreviewElt);
							}

							// Create TOC section element
							sectionTocElt = document.createElement('div');
							sectionTocElt.className = 'cl-toc-section modified';
							var headingElt = sectionPreviewElt.querySelector('h1, h2, h3, h4, h5, h6');
							if (headingElt) {
								headingElt = headingElt.cloneNode(true);
								headingElt.removeAttribute('id');
								sectionTocElt.appendChild(headingElt);
							}
							if (insertBeforeTocElt) {
								tocElt.insertBefore(sectionTocElt, insertBeforeTocElt);
							} else {
								tocElt.appendChild(sectionTocElt);
							}

							newSectionDescList.push({
								section: section,
								editorElt: section.elt,
								previewElt: sectionPreviewElt,
								tocElt: sectionTocElt
							});
						}
					}
				});
				clEditorSvc.sectionDescList = newSectionDescList;
				tocElt.classList[tocElt.querySelector('.cl-toc-section *') ? 'remove' : 'add']('empty');
				runAsyncPreview();
			};

			function runAsyncPreview() {
				function recursiveCall(callbackList) {
					if (callbackList.length) {
						return callbackList.shift()(function() {
							recursiveCall(callbackList);
						});
					}
					var html = previewElt.querySelectorAll('.cl-preview-section').cl_reduce(function(html, elt) {
						if (!elt.exportableHtml) {
							var clonedElt = elt.cloneNode(true);
							clonedElt.querySelectorAll('.MathJax, .MathJax_Display, .MathJax_Preview').cl_each(function(elt) {
								elt.parentNode.removeChild(elt);
							});
							elt.exportableHtml = clonedElt.innerHTML;
						}
						return html + elt.exportableHtml;
					}, '');
					clEditorSvc.previewHtml = html.replace(/^\s+|\s+$/g, '');
					clEditorSvc.previewText = previewElt.textContent;
					clEditorSvc.lastPreviewRefreshed = Date.now();
					debouncedTextToPreviewDiffs();
					$rootScope.$apply();
				}

				var imgLoadingListeners = previewElt.querySelectorAll('.cl-preview-section.modified img').cl_map(function(imgElt) {
					return function(cb) {
						if (!imgElt.src) {
							return cb();
						}
						var img = new Image();
						img.onload = cb;
						img.onerror = cb;
						img.src = imgElt.src;
					};
				});
				recursiveCall(asyncPreviewListeners.concat(imgLoadingListeners));
			}

			var debouncedTextToPreviewDiffs = $window.cledit.Utils.debounce(function() {
				previewTextStartOffset = filenameSpaceElt.textContent.length;
				if (filenameSpaceElt.previousSibling) {
					previewTextStartOffset += filenameSpaceElt.previousSibling.textContent.length;
				}
				clEditorSvc.sectionDescList.cl_each(function(sectionDesc) {
					if (!sectionDesc.textToPreviewDiffs) {
						sectionDesc.previewText = sectionDesc.previewElt.textContent;
						sectionDesc.textToPreviewDiffs = diffMatchPatch.diff_main(sectionDesc.section.text, sectionDesc.previewText);
					}
				});
				clEditorSvc.lastTextToPreviewDiffs = Date.now();
				$rootScope.$apply();
			}, 50);


			clEditorSvc.getPreviewOffset = function(textOffset) {
				var previewOffset = previewTextStartOffset;
				clEditorSvc.sectionDescList.cl_some(function(sectionDesc) {
					if (!sectionDesc.textToPreviewDiffs) {
						previewOffset = undefined;
						return true;
					}
					if (sectionDesc.section.text.length >= textOffset) {
						previewOffset += diffMatchPatch.diff_xIndex(sectionDesc.textToPreviewDiffs, textOffset);
						return true;
					}
					textOffset -= sectionDesc.section.text.length;
					previewOffset += sectionDesc.previewText.length;
				});
				return previewOffset;
			};

			var saveSelection = $window.cledit.Utils.debounce(function() {
				var selection = $window.getSelection();
				var range = selection.rangeCount && selection.getRangeAt(0);
				if (range) {
					if (!clEditorSvc.previewElt ||
						!(clEditorSvc.previewElt.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY) ||
						!(clEditorSvc.previewElt.compareDocumentPosition(range.endContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY)
					) {
						range = undefined;
					}
				}
				if (clEditorSvc.previewSelectionRange !== range) {
					clEditorSvc.previewSelectionRange = range;
					$rootScope.$apply();
				}
			}, 50);

			$window.addEventListener('keyup', saveSelection);
			$window.addEventListener('mouseup', saveSelection);
			$window.addEventListener('contextmenu', saveSelection);

			function SectionDimension(startOffset, endOffset) {
				this.startOffset = startOffset;
				this.endOffset = endOffset;
				this.height = endOffset - startOffset;
			}

			function dimensionNormalizer(dimensionName) {
				return function() {
					var dimensionList = clEditorSvc.sectionDescList.cl_map(function(sectionDesc) {
						return sectionDesc[dimensionName];
					});
					var dimension, i, j;
					for (i = 0; i < dimensionList.length; i++) {
						dimension = dimensionList[i];
						if (!dimension.height) {
							continue;
						}
						for (j = i + 1; j < dimensionList.length && dimensionList[j].height === 0; j++) {}
						var normalizeFactor = j - i;
						if (normalizeFactor === 1) {
							continue;
						}
						var normizedHeight = dimension.height / normalizeFactor;
						dimension.height = normizedHeight;
						dimension.endOffset = dimension.startOffset + dimension.height;
						for (j = i + 1; j < i + normalizeFactor; j++) {
							var startOffset = dimension.endOffset;
							dimension = dimensionList[j];
							dimension.startOffset = startOffset;
							dimension.height = normizedHeight;
							dimension.endOffset = dimension.startOffset + dimension.height;
						}
						i = j - 1;
					}
				};
			}

			var normalizeEditorDimensions = dimensionNormalizer('editorDimension');
			var normalizePreviewDimensions = dimensionNormalizer('previewDimension');
			var normalizeTocDimensions = dimensionNormalizer('tocDimension');

			clEditorSvc.measureSectionDimensions = function() {
				var editorSectionOffset = 0;
				var previewSectionOffset = 0;
				var tocSectionOffset = 0;
				var sectionDesc = clEditorSvc.sectionDescList[0];
				var nextSectionDesc;
				for (var i = 1; i < clEditorSvc.sectionDescList.length; i++) {
					nextSectionDesc = clEditorSvc.sectionDescList[i];

					// Measure editor section
					var newEditorSectionOffset = nextSectionDesc.editorElt && nextSectionDesc.editorElt.firstChild ? nextSectionDesc.editorElt.firstChild.offsetTop : editorSectionOffset;
					newEditorSectionOffset = newEditorSectionOffset > editorSectionOffset ? newEditorSectionOffset : editorSectionOffset;
					sectionDesc.editorDimension = new SectionDimension(editorSectionOffset, newEditorSectionOffset);
					editorSectionOffset = newEditorSectionOffset;

					// Measure preview section
					var newPreviewSectionOffset = nextSectionDesc.previewElt ? nextSectionDesc.previewElt.offsetTop : previewSectionOffset;
					newPreviewSectionOffset = newPreviewSectionOffset > previewSectionOffset ? newPreviewSectionOffset : previewSectionOffset;
					sectionDesc.previewDimension = new SectionDimension(previewSectionOffset, newPreviewSectionOffset);
					previewSectionOffset = newPreviewSectionOffset;

					// Measure TOC section
					var newTocSectionOffset = nextSectionDesc.tocElt ? nextSectionDesc.tocElt.offsetTop + nextSectionDesc.tocElt.offsetHeight / 2 : tocSectionOffset;
					newTocSectionOffset = newTocSectionOffset > tocSectionOffset ? newTocSectionOffset : tocSectionOffset;
					sectionDesc.tocDimension = new SectionDimension(tocSectionOffset, newTocSectionOffset);
					tocSectionOffset = newTocSectionOffset;

					sectionDesc = nextSectionDesc;
				}

				// Last section
				sectionDesc = clEditorSvc.sectionDescList[i - 1];
				if (sectionDesc) {
					sectionDesc.editorDimension = new SectionDimension(editorSectionOffset, editorElt.scrollHeight);
					sectionDesc.previewDimension = new SectionDimension(previewSectionOffset, previewElt.scrollHeight);
					sectionDesc.tocDimension = new SectionDimension(tocSectionOffset, tocElt.scrollHeight);
				}

				normalizeEditorDimensions();
				normalizePreviewDimensions();
				normalizeTocDimensions();

				clEditorSvc.lastSectionMeasured = Date.now();
			};

			clEditorSvc.scrollToAnchor = function(anchor) {
				var scrollTop = 0,
					scrollerElt = clEditorSvc.previewElt.parentNode;
				var sectionDesc = anchorHash[anchor];
				if (sectionDesc) {
					if (clEditorLayoutSvc.isPreviewVisible) {
						scrollTop = sectionDesc.previewDimension.startOffset - filenameSpaceElt.offsetHeight;
					} else {
						scrollTop = sectionDesc.editorDimension.startOffset - clEditorSvc.scrollOffset;
						scrollerElt = clEditorSvc.editorElt.parentNode;
					}
				} else {
					var elt = document.getElementById(anchor);
					if (elt) {
						scrollTop = elt.offsetTop - filenameSpaceElt.offsetHeight;
					}
				}
				scrollerElt.clanim.scrollTop(scrollTop > 0 ? scrollTop : 0).duration(360).easing('materialOut').start();
			};

			clEditorSvc.applyTemplate = function(template) {
				var view = {
					file: {
						name: currentFileDao.name,
						content: {
							properties: currentFileDao.contentDao.properties,
							text: currentFileDao.contentDao.text,
							html: clEditorSvc.previewHtml,
						},
					}
				};
				var worker = new Worker(clVersion.getAssetPath('templateWorker-min.js'));
				worker.postMessage([template, view, clSettingSvc.values.handlebarsHelpers]);
				return $q(function(resolve, reject) {
					worker.addEventListener('message', function(e) {
						resolve(e.data.toString());
					});
					setTimeout(function() {
						worker.terminate();
						reject('Template generation timeout.');
					}, 10000);
				});
			};

			return clEditorSvc;
		})
	.run(
		function($window, $rootScope, $location, $route, clEditorSvc) {

			var lastSectionMeasured = clEditorSvc.lastSectionMeasured;
			var unwatch = $rootScope.$watch('editorSvc.lastSectionMeasured', function(value) {
				var hash = $location.hash();
				if (hash && value !== lastSectionMeasured) {
					clEditorSvc.scrollToAnchor(hash);
					unwatch();
				}
			});

			$rootScope.$on('$locationChangeStart', function(evt, urlAfter, urlBefore) {
				if (urlBefore !== urlAfter) {
					var splitUrl = urlAfter.split('#');
					if (splitUrl.length === 3) {
						var hash = splitUrl[2];
						var hashPos = splitUrl[0].length + splitUrl[1].length;
						if (urlBefore.slice(0, hashPos) === urlAfter.slice(0, hashPos)) {
							evt.preventDefault();
							clEditorSvc.scrollToAnchor(hash);
						}
					}
				}
			});
		});
