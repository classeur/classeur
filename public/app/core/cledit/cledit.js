angular.module('classeur.core.cledit', [])
	.directive('clEditor', function($timeout, cledit, layout, settings) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/cledit/editor.html',
			link: function(scope, element) {
				cledit.setEditorElt(element[0].querySelector('.editor'));

				var debouncedRefreshPreview = window.ced.Utils.debounce(function() {
					cledit.convert();
					scope.$apply();
					setTimeout(function() {
						cledit.refreshPreview(function() {
							scope.$apply();
						});
					}, 1);
				}, settings.values.refreshPreviewDelay);
				cledit.editor.onContentChanged(function(content, sectionList) {
					$timeout(function() {
						cledit.sectionList = sectionList;
						debouncedRefreshPreview();
					});
				});

				var isInited;
				scope.$watch('cledit.options', function() {
					cledit.forcePreviewRefresh();
					cledit.editor.init(cledit.options);
					if(!isInited) {
						cledit.editor.setSelection(0, 0);
						isInited = true;
					}
					debouncedRefreshPreview();
				});
				scope.$watch('layout.isEditorOpen', function() {
					cledit.editor.toggleEditable(layout.isEditorOpen);
				});

				var debouncedMeasureSectionDimension = window.ced.Utils.debounce(function() {
					cledit.measureSectionDimensions();
					scope.$apply();
				}, settings.values.measureSectionDelay);
				scope.$watch('cledit.lastPreview', debouncedMeasureSectionDimension);
				scope.$watch('cledit.editorSize()', debouncedMeasureSectionDimension);
				scope.$watch('cledit.previewSize()', debouncedMeasureSectionDimension);
			}
		};
	})
	.directive('clPreview', function(cledit) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/cledit/preview.html',
			link: function(scope, element) {
				cledit.setPreviewElt(element[0].querySelector('.preview'));
			}
		};
	})
	.directive('clToc', function(cledit) {
		return {
			restrict: 'E',
			templateUrl: 'app/core/cledit/toc.html',
			link: function(scope, element) {
				var tocElt = element[0].querySelector('.toc');
				cledit.setTocElt(tocElt);

				var isMousedown;
				function onClick(e) {
					if(!isMousedown) {
						return;
					}
					e.preventDefault();
					var y = e.clientY + tocElt.parentNode.scrollTop;

					cledit.sectionDescList.some(function(sectionDesc) {
						if(y < sectionDesc.tocDimension.endOffset) {
							var posInSection = (y - sectionDesc.tocDimension.startOffset) / (sectionDesc.tocDimension.height || 1);
							var editorScrollTop = sectionDesc.editorDimension.startOffset + sectionDesc.editorDimension.height * posInSection;
							cledit.editorElt.parentNode.scrollTop = editorScrollTop - 100;
							var previewScrollTop = sectionDesc.previewDimension.startOffset + sectionDesc.previewDimension.height * posInSection;
							cledit.previewElt.parentNode.scrollTop = previewScrollTop - 100;
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
				tocElt.addEventListener("mousemove", function(e){
					onClick(e);
				});
			}
		};
	})
	.factory('cledit', function(prism, settings) {
		settings.setDefaultValue('refreshPreviewDelay', 500);
		settings.setDefaultValue('measureSectionDelay', 1000);

		window.rangy.init();

		var editorElt, previewElt, tocElt;
		var linkDefinition;
		var doFootnotes, hasFootnotes;
		var sectionsToRemove, modifiedSections, insertBeforeSection;
		var sectionDelimiters = [];
		var prismOptions = {};
		var forcePreviewRefresh = true;
		var converterInitListeners = [];
		var asyncPreviewListeners = [];
		var cledit = {
			options: {
				language: prism(prismOptions)
			},
			initConverter: function() {
				cledit.converter = new window.Markdown.Converter();
				asyncPreviewListeners = [];
				converterInitListeners.forEach(function(listener) {
					listener(cledit.converter);
				});
			},
			onInitConverter: function(priority, listener) {
				converterInitListeners[priority] = listener;
			},
			onAsyncPreview: function(listener) {
				asyncPreviewListeners.push(listener);
			},
			forcePreviewRefresh: function() {
				forcePreviewRefresh = true;
			},
			setPrismOptions: function(options) {
				prismOptions = angular.extend(prismOptions, options);
				this.options = angular.extend({}, this.options);
				this.options.language = prism(prismOptions);
			},
			setSectionDelimiter: function(priority, sectionDelimiter) {
				sectionDelimiters[priority] = sectionDelimiter;
				this.options = angular.extend({}, this.options);
				this.options.sectionDelimiter = sectionDelimiters.join('');
			},
			setPreviewElt: function(elt) {
				previewElt = elt;
				this.previewElt = elt;
			},
			setTocElt: function(elt) {
				tocElt = elt;
				this.tocElt = elt;
			},
			setEditorElt: function(elt) {
				editorElt = elt;
				this.editorElt = elt;
				cledit.editor = window.ced(elt, elt.parentNode);
				cledit.pagedownEditor = new window.Markdown.Editor(cledit.converter, {
					input: Object.create(cledit.editor)
				});
				cledit.pagedownEditor.run();
			},
			editorSize: function() {
				return editorElt.clientWidth + 'x' + editorElt.clientHeight;
			},
			previewSize: function() {
				return previewElt.clientWidth + 'x' + previewElt.clientHeight;
			}
		};
		cledit.initConverter();
		cledit.setSectionDelimiter(50, '^.+[ \\t]*\\n=+[ \\t]*\\n+|^.+[ \\t]*\\n-+[ \\t]*\\n+|^\\#{1,6}[ \\t]*.+?[ \\t]*\\#*\\n+');

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

		var footnoteContainerElt;
		var htmlElt = document.createElement('div');

		function updateSectionDescList() {
			var sectionDescList = cledit.sectionDescList || [];
			var newSectionDescList = [];
			var newLinkDefinition = '\n';
			hasFootnotes = false;
			cledit.sectionList.forEach(function(section) {
				var text = '\n<div class="classeur-preview-section-delimiter"></div>\n\n' + section.text + '\n\n';

				// Strip footnotes
				if(doFootnotes) {
					text = text.replace(/^```.*\n[\s\S]*?\n```|\n[ ]{0,3}\[\^(.+?)\]\:[ \t]*\n?([\s\S]*?)\n{1,2}((?=\n[ ]{0,3}\S)|$)/gm, function(wholeMatch, footnote) {
						if(footnote) {
							hasFootnotes = true;
							newLinkDefinition += wholeMatch.replace(/^\s*\n/gm, '') + '\n';
							return "";
						}
						return wholeMatch;
					});
				}

				// Strip link definitions
				text = text.replace(/^```.*\n[\s\S]*?\n```|^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?(?=\s|$)[ \t]*\n?[ \t]*((\n*)["(](.+?)[")][ \t]*)?(?:\n+)/gm, function(wholeMatch, link) {
					if(link) {
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
			if(forcePreviewRefresh || linkDefinition != newLinkDefinition) {
				forcePreviewRefresh = false;
				linkDefinition = newLinkDefinition;
				sectionsToRemove = sectionDescList;
				cledit.sectionDescList = newSectionDescList;
				modifiedSections = newSectionDescList;
				return;
			}

			// Find modified section starting from top
			var leftIndex = sectionDescList.length;
			sectionDescList.some(function(sectionDesc, index) {
				var newSectionDesc = newSectionDescList[index];
				if(index >= newSectionDescList.length || sectionDesc.text != newSectionDesc.text) {
					leftIndex = index;
					return true;
				}
				// Replace old elements in case markdown section has changed
				sectionDesc.editorElt = newSectionDesc.editorElt;
			});

			// Find modified section starting from bottom
			var rightIndex = -sectionDescList.length;
			var boundary = Math.min(sectionDescList.length, newSectionDescList.length);
			sectionDescList.slice().reverse().some(function(sectionDesc, index) {
				var newSectionDesc = newSectionDescList[newSectionDescList.length - index - 1];
				if(index >= newSectionDescList.length || sectionDesc.text != newSectionDesc.text) {
					rightIndex = -index;
					return true;
				}
				if(leftIndex - rightIndex > boundary) {
					// Prevent overlap
					rightIndex = leftIndex - boundary;
					return true;
				}
				// Replace old editor element in case markdown section has changed
				sectionDesc.editorElt = newSectionDesc.editorElt;
			});

			// Create an array composed of left unmodified, modified, right
			// unmodified sections
			var leftSections = sectionDescList.slice(0, leftIndex);
			modifiedSections = newSectionDescList.slice(leftIndex, newSectionDescList.length + rightIndex);
			var rightSections = sectionDescList.slice(sectionDescList.length + rightIndex, sectionDescList.length);
			insertBeforeSection = rightSections[0];
			sectionsToRemove = sectionDescList.slice(leftIndex, sectionDescList.length + rightIndex);
			cledit.sectionDescList = leftSections.concat(modifiedSections).concat(rightSections);
		}

		cledit.convert = function() {
			updateSectionDescList();

			var textToConvert = modifiedSections.map(function(section) {
				return section.text;
			});
			textToConvert.push(linkDefinition + "\n\n");
			textToConvert = textToConvert.join("");

			var html = cledit.converter.makeHtml(textToConvert);
			htmlElt.innerHTML = html;

			cledit.lastConvert = Date.now();
		};

		cledit.refreshPreview = function(cb) {

			if(!footnoteContainerElt) {
				footnoteContainerElt = document.createElement('div');
				footnoteContainerElt.className = 'preview-content';
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
				while(childNode) {
					var nextNode = childNode.nextSibling;
					var isDelimiter = childNode.className == 'classeur-preview-section-delimiter';
					if(isNextDelimiter === true && childNode.tagName == 'DIV' && isDelimiter) {
						// Stop when encountered the next delimiter
						break;
					}
					isNextDelimiter = true;
					if(childNode.tagName == 'DIV' && childNode.className == 'footnotes') {
						Array.prototype.forEach.call(childNode.querySelectorAll("ol > li"), storeFootnote);
					}
					else {
						isDelimiter || sectionPreviewElt.appendChild(childNode);
					}
					childNode = nextNode;
				}
				sectionDesc.previewElt = sectionPreviewElt;
				newPreviewEltList.appendChild(sectionPreviewElt);

				// Create section TOC elt
				var sectionTocElt = document.createElement('div');
				sectionTocElt.id = 'classeur-toc-section-' + sectionDesc.id;
				sectionTocElt.className = 'classeur-toc-section modified';
				var titleElt = sectionPreviewElt.querySelector('h1, h2, h3, h4, h5, h6');
				titleElt && sectionTocElt.appendChild(titleElt.cloneNode(true));
				sectionDesc.tocElt = sectionTocElt;
				newTocEltList.appendChild(sectionTocElt);
			}

			modifiedSections.forEach(createSectionElt);
			var insertBeforePreviewElt = footnoteContainerElt;
			var insertBeforeTocElt;
			if(insertBeforeSection !== undefined) {
				insertBeforePreviewElt = document.getElementById('classeur-preview-section-' + insertBeforeSection.id);
				insertBeforeTocElt = document.getElementById('classeur-toc-section-' + insertBeforeSection.id);
			}
			previewElt.insertBefore(newPreviewEltList, insertBeforePreviewElt);
			insertBeforeTocElt ? tocElt.insertBefore(newTocEltList, insertBeforeTocElt) : tocElt.appendChild(newTocEltList);

			// Rewrite footnotes in the footer and update footnote numbers
			footnoteContainerElt.innerHTML = '';
			var usedFootnoteIds = [];
			if(hasFootnotes === true) {
				var footnoteElts = document.createElement('ol');
				Array.prototype.forEach.call(previewElt.querySelectorAll('a.footnote'), function(elt, index) {
					elt.textContent = index + 1;
					var id = elt.id.substring(6);
					usedFootnoteIds.push(id);
					var footnoteElt = footnoteMap[id];
					footnoteElt && footnoteElts.appendChild(footnoteElt.cloneNode(true));
				});
				if(usedFootnoteIds.length > 0) {
					// Append the whole footnotes at the end of the document
					var divElt = document.createElement('div');
					divElt.className = 'footnotes';
					divElt.appendChild(document.createElement('hr'));
					divElt.appendChild(footnoteElts);
					footnoteContainerElt.appendChild(divElt);
				}
				// Keep used footnotes only in our map
				Object.keys(footnoteMap).forEach(function(key) {
					if(usedFootnoteIds.indexOf(key) === -1) {
						footnoteFragment.removeChild(footnoteMap[key]);
						delete footnoteMap[key];
					}
				});
			}
			runAsyncPreview(cb);
		};

		function runAsyncPreview(cb) {
			function recursiveCall(callbackList) {
				if(callbackList.length) {
					return callbackList.shift()(function() {
						recursiveCall(callbackList);
					});
				}
				var html = Array.prototype.reduce.call(previewElt.children, function(html, elt) {
					return html + elt.innerHTML;
				}, '');
				cledit.previewHtml = html.replace(/^\s+|\s+$/g, '');
				cledit.previewText = previewElt.textContent;
				cledit.lastPreview = Date.now();
				cb();
			}

			var imgLoadingListeners = Array.prototype.map.call(previewElt.querySelectorAll('img'), function(imgElt) {
				return function(cb) {
					if(!imgElt.src) {
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
				var dimensionList = cledit.sectionDescList.map(function(sectionDesc) {
					return sectionDesc[dimensionName];
				});
				var dimension, i, j;
				for(i = 0; i < dimensionList.length; i++) {
					dimension = dimensionList[i];
					if(!dimension.height) {
						continue;
					}
					for(j = i + 1; j < dimensionList.length && dimensionList[j].height === 0; j++) {
					}
					var normalizeFactor = j - i;
					if(normalizeFactor === 1) {
						continue;
					}
					var normizedHeight = dimension.height / normalizeFactor;
					dimension.height = normizedHeight;
					dimension.endOffset = dimension.startOffset + dimension.height;
					for(j = i + 1; j < i + normalizeFactor; j++) {
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

		cledit.measureSectionDimensions = function() {
			var editorSectionOffset = 0;
			var previewSectionOffset = 0;
			var tocSectionOffset = 0;
			var sectionDesc = cledit.sectionDescList[0];
			var nextSectionDesc;
			for(var i = 1; i < cledit.sectionDescList.length; i++) {
				nextSectionDesc = cledit.sectionDescList[i];

				// Measure editor section
				var newEditorSectionOffset = nextSectionDesc.editorElt && nextSectionDesc.editorElt.firstChild ? nextSectionDesc.editorElt.firstChild.offsetTop : editorSectionOffset;
				sectionDesc.editorDimension = new SectionDimension(editorSectionOffset, newEditorSectionOffset);
				editorSectionOffset = newEditorSectionOffset;

				// Measure preview section
				var newPreviewSectionOffset = nextSectionDesc.previewElt ? nextSectionDesc.previewElt.offsetTop : previewSectionOffset;
				sectionDesc.previewDimension = new SectionDimension(previewSectionOffset, newPreviewSectionOffset);
				previewSectionOffset = newPreviewSectionOffset;

				// Measure TOC section
				var newTocSectionOffset = nextSectionDesc.tocElt ? nextSectionDesc.tocElt.offsetTop + nextSectionDesc.tocElt.offsetHeight/2 : tocSectionOffset;
				sectionDesc.tocDimension = new SectionDimension(tocSectionOffset, newTocSectionOffset);
				tocSectionOffset = newTocSectionOffset;
				sectionDesc = nextSectionDesc;
			}

			// Last section
			sectionDesc = cledit.sectionDescList[i - 1];
			sectionDesc.editorDimension = new SectionDimension(editorSectionOffset, editorElt.scrollHeight);
			sectionDesc.previewDimension = new SectionDimension(previewSectionOffset, previewElt.scrollHeight);
			sectionDesc.tocDimension = new SectionDimension(tocSectionOffset, tocElt.scrollHeight);

			normalizeEditorDimensions();
			normalizePreviewDimensions();
			normalizeTocDimensions();

			cledit.lastMeasure = Date.now();
		};

		return cledit;
	});

