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

				scope.$watch('cledit.options', function() {
					cledit.forcePreviewRefresh();
					cledit.editor.init(cledit.options);
					debouncedRefreshPreview();
				});
				scope.$watch('layout.isEditorOpen', function() {
					cledit.editor.toggleEditable(layout.isEditorOpen);
				});
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
	.factory('cledit', function(prism, settings) {
		settings.setDefaultValue('refreshPreviewDelay', 500);

		window.rangy.init();

		var editorElt, previewElt;
		var oldSectionList, oldLinkDefinition;
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
			},
			setEditorElt: function(elt) {
				editorElt = elt;
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

		function updateSectionList() {
			var newSectionList = [];
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
				newSectionList.push({
					id: section.id,
					text: text + '\n'
				});
			});

			modifiedSections = [];
			sectionsToRemove = [];
			insertBeforeSection = undefined;

			// Render everything if file or linkDefinition changed
			if(forcePreviewRefresh || oldLinkDefinition != newLinkDefinition) {
				forcePreviewRefresh = false;
				oldLinkDefinition = newLinkDefinition;
				sectionsToRemove = oldSectionList || [];
				oldSectionList = newSectionList;
				modifiedSections = newSectionList;
				return;
			}

			// Find modified section starting from top
			var leftIndex = oldSectionList.length;
			oldSectionList.some(function(section, index) {
				if(index >= newSectionList.length || section.text != newSectionList[index].text) {
					leftIndex = index;
					return true;
				}
			});

			// Find modified section starting from bottom
			var rightIndex = -oldSectionList.length;
			oldSectionList.slice().reverse().some(function(section, index) {
				if(index >= newSectionList.length || section.text != newSectionList[newSectionList.length - index - 1].text) {
					rightIndex = -index;
					return true;
				}
			});

			if(leftIndex - rightIndex > oldSectionList.length) {
				// Prevent overlap
				rightIndex = leftIndex - oldSectionList.length;
			}

			// Create an array composed of left unmodified, modified, right
			// unmodified sections
			var leftSections = oldSectionList.slice(0, leftIndex);
			modifiedSections = newSectionList.slice(leftIndex, newSectionList.length + rightIndex);
			var rightSections = oldSectionList.slice(oldSectionList.length + rightIndex, oldSectionList.length);
			insertBeforeSection = rightSections[0];
			sectionsToRemove = oldSectionList.slice(leftIndex, oldSectionList.length + rightIndex);
			oldSectionList = leftSections.concat(modifiedSections).concat(rightSections);
		}

		cledit.convert = function() {
			updateSectionList();

			var textToConvert = modifiedSections.map(function(section) {
				return section.text;
			});
			textToConvert.push(oldLinkDefinition + "\n\n");
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
				var sectionElt = document.getElementById('classeur-preview-section-' + section.id);
				previewElt.removeChild(sectionElt);
			});

			var childNode = htmlElt.firstChild;

			function createSectionElt(section) {
				var sectionElt = document.createElement('div');
				sectionElt.id = 'classeur-preview-section-' + section.id;
				sectionElt.className = 'classeur-preview-section';
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
						isDelimiter || sectionElt.appendChild(childNode);
					}
					childNode = nextNode;
				}
				return sectionElt;
			}

			var newSectionEltList = document.createDocumentFragment();
			modifiedSections.forEach(function(section) {
				newSectionEltList.appendChild(createSectionElt(section));
			});
			var insertBeforeElt = footnoteContainerElt;
			if(insertBeforeSection !== undefined) {
				insertBeforeElt = document.getElementById('classeur-preview-section-' + insertBeforeSection.id);
			}
			previewElt.insertBefore(newSectionEltList, insertBeforeElt);

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
				cledit.html = html.replace(/^\s+|\s+$/g, '');
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

		return cledit;
	});

