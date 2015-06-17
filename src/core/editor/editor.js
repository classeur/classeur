angular.module('classeur.core.editor', [])
	.directive('clEditor',
		function($window, $timeout, $$sanitizeUri, clEditorSvc, clEditorLayoutSvc, clSettingSvc, clKeystrokeSvc) {
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
					clEditorSvc.updateSectionDescList();
					clEditorSvc.convert();
					setTimeout(function() {
						clEditorSvc.refreshPreview(scope.$apply.bind(scope));
					}, 10);
				}

				var debouncedRefreshPreview = $window.cledit.Utils.debounce(function() {
					if (checkState()) {
						return;
					}
					refreshPreview();
					scope.$apply();
				}, 500);

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
						section.imgTokenEltList = section.elt.getElementsByClassName('token img');
						Array.prototype.slice.call(section.imgTokenEltList).forEach(function(imgTokenElt) {
							var srcElt = imgTokenElt.querySelector('.token.md-src');
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

				// Add custom keystrokes
				clKeystrokeSvc(clEditorSvc);

				var isInited;
				scope.$watch('editorSvc.options', function(options) {
					clEditorSvc.forcePreviewRefresh();
					if (!isInited) {
						options = angular.extend({}, options);
						options.content = scope.currentFileDao.contentDao.text;
						if (options.content.slice(-1) !== '\n') {
							options.content += '\n';
						}
						['selectionStart', 'selectionEnd', 'scrollTop'].forEach(function(key) {
							options[key] = scope.currentFileDao.contentDao.state[key];
						});
						isInited = true;
					}
					clEditorSvc.cledit.init(options);
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
				}, 1000);
				scope.$watch('editorSvc.lastPreviewRefreshed', onPreviewRefreshed);
				scope.$watch('editorSvc.editorSize()', debouncedMeasureSectionDimension);
				scope.$watch('editorSvc.previewSize()', debouncedMeasureSectionDimension);
				scope.$watch('editorLayoutSvc.isPreviewVisible', function(isVisible) {
					isVisible && state && clEditorSvc.measureSectionDimensions();
				});
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					!currentControl && setTimeout(function() {
						clEditorSvc.cledit && clEditorSvc.cledit.focus();
					}, 1);
				});
			}
		})
	.directive('clPreview',
		function(clEditorSvc) {
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
			}
		})
	.directive('clToc',
		function(clEditorSvc) {
			return {
				restrict: 'E',
				templateUrl: 'core/editor/toc.html',
				link: link
			};

			function link(scope, element) {
				var tocElt = element[0].querySelector('.toc.content');
				clEditorSvc.setTocElt(tocElt);

				var isMousedown;
				var scrollerElt = tocElt.parentNode.parentNode.parentNode;

				function onClick(e) {
					if (!isMousedown) {
						return;
					}
					e.preventDefault();
					var y = e.clientY + scrollerElt.scrollTop;

					clEditorSvc.sectionDescList.some(function(sectionDesc) {
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
		function($window, clEditorSvc) {
			function ClassApplier(classes, offsetGetter, properties) {
				classes = typeof classes === 'string' ? [classes] : classes;
				var self = this;
				$window.cledit.Utils.createEventHooks(this);
				this.elts = clEditorSvc.editorElt.getElementsByClassName(classes[0]);
				var lastEltCount;

				function applyClass() {
					var offset = offsetGetter();
					if (!offset) {
						return;
					}
					var range = clEditorSvc.cledit.selectionMgr.createRange(
						Math.min(offset.start, offset.end),
						Math.max(offset.start, offset.end)
					);
					properties = properties || {};
					properties.className = classes.join(' ');
					var rangeLength = ('' + range).length;
					var wrappedLength = 0;
					var treeWalker = $window.document.createTreeWalker(clEditorSvc.editorElt, NodeFilter.SHOW_TEXT);
					var startOffset = range.startOffset;
					treeWalker.currentNode = range.startContainer;
					clEditorSvc.cledit.watcher.noWatch(function() {
						do {
							if (treeWalker.currentNode.nodeValue !== '\n') {
								if (treeWalker.currentNode === range.endContainer && range.endOffset < treeWalker.currentNode.nodeValue.length) {
									treeWalker.currentNode.splitText(range.endOffset);
								}
								if (startOffset) {
									treeWalker.currentNode = treeWalker.currentNode.splitText(startOffset);
									startOffset = 0;
								}
								var elt = $window.document.createElement('span');
								for (var key in properties) {
									elt[key] = properties[key];
								}
								treeWalker.currentNode.parentNode.insertBefore(elt, treeWalker.currentNode);
								elt.appendChild(treeWalker.currentNode);
							}
							wrappedLength += treeWalker.currentNode.nodeValue.length;
							if (wrappedLength >= rangeLength) {
								break;
							}
						}
						while (treeWalker.nextNode());
					});
					self.$trigger('classApplied');
					clEditorSvc.cledit.selectionMgr.restoreSelection();
					lastEltCount = self.elts.length;
				}

				function removeClass() {
					clEditorSvc.cledit.watcher.noWatch(function() {
						Array.prototype.slice.call(self.elts).forEach(function(elt) {
							var child = elt.firstChild;
							if (child.nodeType === 3) {
								if (elt.previousSibling && elt.previousSibling.nodeType === 3) {
									child.nodeValue = elt.previousSibling.nodeValue + child.nodeValue;
									elt.parentNode.removeChild(elt.previousSibling);
								}
								if (elt.nextSibling && elt.nextSibling.nodeType === 3) {
									child.nodeValue = child.nodeValue + elt.nextSibling.nodeValue;
									elt.parentNode.removeChild(elt.nextSibling);
								}
							}
							elt.parentNode.insertBefore(child, elt);
							elt.parentNode.removeChild(elt);
						});
					});
				}

				function restoreClass() {
					if (self.elts.length !== lastEltCount) {
						removeClass();
						applyClass();
					}
				}

				this.stop = function() {
					clEditorSvc.cledit.off('contentChanged', restoreClass);
					removeClass();
				};

				clEditorSvc.cledit.on('contentChanged', restoreClass);
				applyClass();
			}

			return function(classes, offsetGetter, properties) {
				return new ClassApplier(classes, offsetGetter, properties);
			};
		})
	.factory('clEditorSvc',
		function($window, $timeout, clSettingSvc, clEditorLayoutSvc, Slug) {

			// Create aliases for syntax highlighting
			var Prism = $window.Prism;
			angular.forEach({
				'js': 'javascript',
				'html': 'markup',
				'svg': 'markup',
				'xml': 'markup',
				'py': 'python',
				'rb': 'ruby',
				'ps1': 'powershell',
				'psm1': 'powershell'
			}, function(name, alias) {
				Prism.languages[alias] = Prism.languages[name];
			});

			var insideFcb = {};
			angular.forEach(Prism.languages, function(language, name) {
				if (Prism.util.type(language) === 'Object') {
					insideFcb['language-' + name] = {
						pattern: new RegExp('`{3}' + name + '\\W[\\s\\S]*'),
						inside: {
							"md md-pre": /`{3}.*/,
							rest: language
						}
					};
				}
			});

			Prism.hooks.add('wrap', function(env) {
				if (env.type === 'code' || env.type.match(/^pre($|\b)/)) {
					env.attributes.spellcheck = 'false';
				}
			});

			var editorElt, previewElt, tocElt;
			var filenameSpaceElt;
			var linkDefinition;
			var doFootnotes, hasFootnotes;
			var sectionsToRemove, modifiedSections, insertBeforeSection;
			var sectionDelimiters = [];
			var prismOptions = {
				insideFcb: insideFcb
			};
			var forcePreviewRefresh = true;
			var changeListeners = [];
			var converterInitListeners = [];
			var asyncPreviewListeners = [];
			var footnoteContainerElt;
			var currentFileDao;

			var clEditorSvc = {
				options: {},
				setCurrentFileDao: function(fileDao) {
					currentFileDao = fileDao;
				},
				initConverter: function() {
					var fileProperties = currentFileDao.contentDao.properties;
					doFootnotes = fileProperties['ext:mdextra'] !== '0' && fileProperties['ext:mdextra:footnotes'] !== '0';
					clEditorSvc.converter = new $window.Markdown.Converter();
					asyncPreviewListeners = [];
					converterInitListeners.forEach(function(listener) {
						listener(clEditorSvc.converter);
					});
				},
				onInitConverter: function(priority, listener) {
					converterInitListeners[priority] = listener;
				},
				hasInitListener: function(priority) {
					return converterInitListeners.hasOwnProperty(priority);
				},
				onAsyncPreview: function(listener) {
					asyncPreviewListeners.push(listener);
				},
				forcePreviewRefresh: function() {
					forcePreviewRefresh = true;
				},
				setPrismOptions: function(options) {
					prismOptions = angular.extend(prismOptions, options);
					var grammar = $window.mdGrammar(prismOptions);
					// Create new object for watchers
					this.options = angular.extend({}, this.options);
					this.options.highlighter = function(text) {
						return Prism.highlight(text, grammar);
					};
				},
				setSectionDelimiter: function(priority, sectionDelimiter) {
					sectionDelimiters[priority] = sectionDelimiter;
					this.options = angular.extend({}, this.options);
					this.options.sectionDelimiter = sectionDelimiters.join('');
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
					// console.watch(elt.parentNode, "scrollTop");
					editorElt = elt;
					this.editorElt = elt;
					clEditorSvc.sectionDescList = [];
					footnoteContainerElt = undefined;
					clEditorSvc.cledit = $window.cledit(elt, elt.parentNode);
					changeListeners = [];
					clEditorSvc.cledit.on('contentChanged', function() {
						changeListeners.forEach(function(changeListener) {
							changeListener();
						});
					});
					clEditorSvc.pagedownEditor = new $window.Markdown.Editor(clEditorSvc.converter, {
						input: Object.create(clEditorSvc.cledit)
					});
					clEditorSvc.pagedownEditor.run();
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
			clEditorSvc.setSectionDelimiter(50, '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+');
			clEditorSvc.lastExternalChange = 0;
			clEditorSvc.scrollOffset = 80;

			var anchorHash = {};
			var footnoteMap = {};
			var footnoteFragment = document.createDocumentFragment();
			// Store one footnote elt in the footnote map
			function storeFootnote(footnoteElt) {
				var id = footnoteElt.id.substring(3);
				var oldFootnote = footnoteMap[id];
				oldFootnote && footnoteFragment.removeChild(oldFootnote);
				footnoteMap[id] = footnoteElt;
				footnoteFragment.appendChild(footnoteElt);
			}

			var htmlElt = document.createElement('div');

			clEditorSvc.updateSectionDescList = function() {
				var sectionDescList = clEditorSvc.sectionDescList;
				var newSectionDescList = [];
				var newLinkDefinition = '\n';
				hasFootnotes = false;
				clEditorSvc.sectionList.forEach(function(section) {
					var text = '\n<div class="classeur-preview-section-delimiter"></div>\n\n' + section.text + '\n\n';

					// Strip footnotes
					if (doFootnotes) {
						text = text.replace(/^```.*\n[\s\S]*?\n```|\n[ ]{0,3}\[\^(.+?)\]\:[ \t]*\n?([\s\S]*?)\n{1,2}((?=\n[ ]{0,3}\S)|$)/gm, function(wholeMatch, footnote) {
							if (footnote) {
								hasFootnotes = true;
								newLinkDefinition += wholeMatch.replace(/^\s*\n/gm, '') + '\n';
								return "";
							}
							return wholeMatch;
						});
					}

					// Strip link definitions
					text = text.replace(/^```.*\n[\s\S]*?\n```|^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?(?=\s|$)[ \t]*\n?[ \t]*((\n*)["(](.+?)[")][ \t]*)?(?:\n+)/gm, function(wholeMatch, link) {
						if (link) {
							newLinkDefinition += wholeMatch.replace(/^\s*\n/gm, '') + '\n';
							return "";
						}
						return wholeMatch;
					});

					// Add section to the newSectionList
					newSectionDescList.push({
						id: section.id,
						editorElt: section.elt,
						text: text + '\n'
					});
				});

				modifiedSections = [];
				sectionsToRemove = [];
				insertBeforeSection = undefined;

				// Render everything if file or linkDefinition changed
				if (forcePreviewRefresh || linkDefinition != newLinkDefinition) {
					forcePreviewRefresh = false;
					linkDefinition = newLinkDefinition;
					sectionsToRemove = sectionDescList;
					clEditorSvc.sectionDescList = newSectionDescList;
					modifiedSections = newSectionDescList;
					return;
				}

				// Find modified section starting from top
				var leftIndex = sectionDescList.length;
				sectionDescList.some(function(sectionDesc, index) {
					var newSectionDesc = newSectionDescList[index];
					if (index >= newSectionDescList.length || sectionDesc.text != newSectionDesc.text) {
						leftIndex = index;
						return true;
					}
					// Replace old elements in case markdown section has changed
					sectionDesc.editorElt = newSectionDesc.editorElt;
				});

				// Find modified section starting from bottom
				var maxIndex = Math.min(sectionDescList.length, newSectionDescList.length);
				var rightIndex = -sectionDescList.length;
				sectionDescList.slice().reverse().some(function(sectionDesc, index) {
					var newSectionDesc = newSectionDescList[newSectionDescList.length - index - 1];
					if (leftIndex + index >= maxIndex || sectionDesc.text != newSectionDesc.text) {
						rightIndex = -index;
						return true;
					}
					// Replace old elements in case markdown section has changed
					sectionDesc.editorElt = newSectionDesc.editorElt;
				});

				// Create an array composed of left unmodified, modified, right
				// unmodified sections
				var leftSections = sectionDescList.slice(0, leftIndex);
				modifiedSections = newSectionDescList.slice(leftIndex, newSectionDescList.length + rightIndex);
				var rightSections = sectionDescList.slice(sectionDescList.length + rightIndex, sectionDescList.length);
				insertBeforeSection = rightSections[0];
				sectionsToRemove = sectionDescList.slice(leftIndex, sectionDescList.length + rightIndex);
				clEditorSvc.sectionDescList = leftSections.concat(modifiedSections).concat(rightSections);
			};

			clEditorSvc.convert = function() {
				var textToConvert = modifiedSections.map(function(section) {
					return section.text;
				});
				textToConvert.push(linkDefinition + "\n\n");
				textToConvert = textToConvert.join("");

				var html = clEditorSvc.converter.makeHtml(textToConvert);
				htmlElt.innerHTML = html;
				clEditorSvc.lastMarkdownConverted = Date.now();
			};

			clEditorSvc.refreshPreview = function(cb) {

				if (!footnoteContainerElt) {
					footnoteContainerElt = document.createElement('div');
					footnoteContainerElt.className = 'classeur-preview-section';
					previewElt.appendChild(footnoteContainerElt);
				}

				// Remove outdated sections
				sectionsToRemove.forEach(function(section) {
					var sectionPreviewElt = document.getElementById('classeur-preview-section-' + section.id);
					previewElt.removeChild(sectionPreviewElt);
					var sectionTocElt = document.getElementById('classeur-toc-section-' + section.id);
					tocElt.removeChild(sectionTocElt);
				});

				// Remove `modified` class
				Array.prototype.forEach.call(document.querySelectorAll('.classeur-preview-section.modified, .classeur-toc-section.modified'), function(elt) {
					elt.className = elt.className.replace(/ modified$/, '');
				});

				var childNode = htmlElt.firstChild;

				var newPreviewEltList = document.createDocumentFragment();
				var newTocEltList = document.createDocumentFragment();

				function createSectionElt(sectionDesc) {

					// Create section preview elt
					var sectionPreviewElt = document.createElement('div');
					sectionPreviewElt.id = 'classeur-preview-section-' + sectionDesc.id;
					sectionPreviewElt.className = 'classeur-preview-section modified';
					var isNextDelimiter = false;
					while (childNode) {
						var nextNode = childNode.nextSibling;
						var isDelimiter = childNode.className == 'classeur-preview-section-delimiter';
						if (isNextDelimiter === true && childNode.tagName == 'DIV' && isDelimiter) {
							// Stop when encountered the next delimiter
							break;
						}
						isNextDelimiter = true;
						if (childNode.tagName == 'DIV' && childNode.className == 'footnotes') {
							Array.prototype.forEach.call(childNode.querySelectorAll("ol > li"), storeFootnote);
						} else {
							isDelimiter || sectionPreviewElt.appendChild(childNode);
						}
						childNode = nextNode;
					}
					sectionDesc.previewElt = sectionPreviewElt;
					sectionPreviewElt.sectionDesc = sectionDesc;
					newPreviewEltList.appendChild(sectionPreviewElt);

					// Create section TOC elt
					var sectionTocElt = document.createElement('div');
					sectionTocElt.id = 'classeur-toc-section-' + sectionDesc.id;
					sectionTocElt.className = 'classeur-toc-section modified';
					var headingElt = sectionPreviewElt.querySelector('h1, h2, h3, h4, h5, h6');
					headingElt && sectionTocElt.appendChild(headingElt.cloneNode(true));
					sectionDesc.tocElt = sectionTocElt;
					newTocEltList.appendChild(sectionTocElt);
				}

				modifiedSections.forEach(createSectionElt);
				var insertBeforePreviewElt = footnoteContainerElt;
				var insertBeforeTocElt;
				if (insertBeforeSection !== undefined) {
					insertBeforePreviewElt = document.getElementById('classeur-preview-section-' + insertBeforeSection.id);
					insertBeforeTocElt = document.getElementById('classeur-toc-section-' + insertBeforeSection.id);
				}
				previewElt.insertBefore(newPreviewEltList, insertBeforePreviewElt);
				insertBeforeTocElt ? tocElt.insertBefore(newTocEltList, insertBeforeTocElt) : tocElt.appendChild(newTocEltList);

				// Rewrite footnotes in the footer and update footnote numbers
				footnoteContainerElt.innerHTML = '';
				var usedFootnoteIds = [];
				if (hasFootnotes === true) {
					var footnoteElts = document.createElement('ol');
					Array.prototype.forEach.call(previewElt.querySelectorAll('a.footnote'), function(elt, index) {
						elt.textContent = index + 1;
						var id = elt.id.substring(6);
						usedFootnoteIds.push(id);
						var footnoteElt = footnoteMap[id];
						footnoteElt && footnoteElts.appendChild(footnoteElt.cloneNode(true));
					});
					if (usedFootnoteIds.length > 0) {
						// Append the whole footnotes at the end of the document
						var divElt = document.createElement('div');
						divElt.className = 'footnotes';
						divElt.appendChild(document.createElement('hr'));
						divElt.appendChild(footnoteElts);
						footnoteContainerElt.appendChild(divElt);
					}
					// Keep used footnotes only in our map
					Object.keys(footnoteMap).forEach(function(key) {
						if (usedFootnoteIds.indexOf(key) === -1) {
							footnoteFragment.removeChild(footnoteMap[key]);
							delete footnoteMap[key];
						}
					});
				}

				// Create anchors
				anchorHash = {};
				Array.prototype.forEach.call(previewElt.querySelectorAll('h1, h2, h3, h4, h5, h6'), function(elt) {
					var sectionDesc = elt.parentNode.sectionDesc;
					if (!sectionDesc) {
						return;
					}
					if (elt.id && !elt.generatedAnchor) {
						anchorHash[elt.id] = sectionDesc;
						return;
					}
					var id = Slug.slugify(elt.textContent) || 'heading';
					var anchor = id;
					var index = 0;
					while (anchorHash.hasOwnProperty(anchor)) {
						anchor = id + '-' + (++index);
					}
					anchorHash[anchor] = sectionDesc;
					elt.id = anchor;
					elt.generatedAnchor = true;
				});

				runAsyncPreview(cb);
			};

			function runAsyncPreview(cb) {
				function recursiveCall(callbackList) {
					if (callbackList.length) {
						return callbackList.shift()(function() {
							recursiveCall(callbackList);
						});
					}
					var html = Array.prototype.reduce.call(previewElt.querySelectorAll('.classeur-preview-section'), function(html, elt) {
						if (!elt.exportableHtml || elt === footnoteContainerElt) {
							var clonedElt = elt.cloneNode(true);
							Array.prototype.forEach.call(clonedElt.querySelectorAll('.MathJax, .MathJax_Display, .MathJax_Preview'), function(elt) {
								elt.parentNode.removeChild(elt);
							});
							elt.exportableHtml = clonedElt.innerHTML;
						}
						return html + elt.exportableHtml;
					}, '');
					clEditorSvc.previewHtml = html.replace(/^\s+|\s+$/g, '');
					clEditorSvc.previewText = previewElt.textContent;
					clEditorSvc.lastPreviewRefreshed = Date.now();
					cb();
				}

				var imgLoadingListeners = Array.prototype.map.call(previewElt.querySelectorAll('img'), function(imgElt) {
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

			function SectionDimension(startOffset, endOffset) {
				this.startOffset = startOffset;
				this.endOffset = endOffset;
				this.height = endOffset - startOffset;
			}

			function dimensionNormalizer(dimensionName) {
				return function() {
					var dimensionList = clEditorSvc.sectionDescList.map(function(sectionDesc) {
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

			var scrollTimeoutId;

			function scroll(elt, startValue, endValue) {
				clearTimeout(scrollTimeoutId);
				var diff = endValue - startValue;
				var startTime = Date.now();

				function tick() {
					var currentTime = Date.now();
					var t = (currentTime - startTime) / 360;
					var scrollTop = endValue;
					if (t < 1) {
						// easeInOutCubic (https://gist.github.com/gre/1650294)
						scrollTop = startValue + diff * (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
						scrollTimeoutId = setTimeout(tick, 10);
					}
					elt.scrollTop = scrollTop;
				}

				scrollTimeoutId = setTimeout(tick, 10);
			}

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
				scroll(scrollerElt, scrollerElt.scrollTop, scrollTop > 0 ? scrollTop : 0);
			};

			clEditorSvc.applyTemplate = function(template) {
				var view = {
					file: {
						name: currentFileDao.name,
						text: currentFileDao.contentDao.text,
						html: clEditorSvc.previewHtml,
						properties: currentFileDao.contentDao.properties
					}
				};
				return $window.Mustache.render(template, view);
			};

			return clEditorSvc;
		})
	.run(
		function($rootScope, $location, $route, clEditorSvc) {

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
					var splitUrl = urlAfter.split(/#(?!\!)/);
					var hash = splitUrl[1];
					if (hash && urlBefore.slice(0, splitUrl[0].length) === splitUrl[0]) {
						evt.preventDefault();
						clEditorSvc.scrollToAnchor(hash);
					}
				}
			});

		});
