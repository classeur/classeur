angular.module('classeur.modules.cledit', [])
	.factory('cledit', function() {

		var oldSectionList, oldLinkDefinition;
		var doFootnotes, hasFootnotes;
		var sectionsToRemove, modifiedSections, insertBeforeSection;
		var cledit = {};

		var converter = new window.Markdown.Converter();

		var footnoteMap = {};
		// Store one footnote elt in the footnote map
		function storeFootnote(footnoteElt) {
			var id = footnoteElt.id.substring(3);
			footnoteMap[id] = footnoteElt;
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
			if(!oldSectionList || oldLinkDefinition != newLinkDefinition) {
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

			var html = converter.makeHtml(textToConvert);
			htmlElt.innerHTML = html;
		};

		cledit.refreshPreview = function() {

			if(!footnoteContainerElt) {
				footnoteContainerElt = document.createElement('div');
				footnoteContainerElt.className = 'preview-content';
				cledit.previewElt.appendChild(footnoteContainerElt);
			}

			// Remove outdated sections
			sectionsToRemove.forEach(function(section) {
				var sectionElt = document.getElementById('classeur-preview-section-' + section.id);
				cledit.previewElt.removeChild(sectionElt);
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
			cledit.previewElt.insertBefore(newSectionEltList, insertBeforeElt);

			// Rewrite footnotes in the footer and update footnote numbers
			footnoteContainerElt.innerHTML = '';
			var usedFootnoteIds = [];
			if(hasFootnotes === true) {
				var footnoteElts = document.createElement('ol');
				Array.prototype.forEach.call(cledit.previewElt.querySelectorAll('a.footnote'), function(elt, index) {
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
						delete footnoteMap[key];
					}
				});
			}

			cledit.lastPreview = Date.now();
		};

		return cledit;
	});

