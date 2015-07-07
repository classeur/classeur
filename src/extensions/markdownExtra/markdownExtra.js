angular.module('classeur.extensions.markdownExtra', [])
	.directive('clMarkdownExtra',
		function($window, clEditorSvc) {

			var options;
			var previewElt;
			var tocRegExp = /^\s*\[(TOC|toc)\]\s*$/;

			clEditorSvc.onInitConverter(50, function(converter) {
				function hasExtension(extensionName) {
					return options && options.extensions.some(function(extension) {
						return extension == extensionName;
					});
				}

				var converterOptions = {};
				if (options && options.intraword) {
					converterOptions = {
						_DoItalicsAndBold: function(text) {
							text = text.replace(/([^\w*]|^)(\*\*|__)(?=\S)(.+?[*_]*)(?=\S)\2(?=[^\w*]|$)/g, "$1<strong>$3</strong>");
							text = text.replace(/([^\w*]|^)(\*|_)(?=\S)(.+?)(?=\S)\2(?=[^\w*]|$)/g, "$1<em>$3</em>");
							// Redo bold to handle _**word**_
							text = text.replace(/([^\w*]|^)(\*\*|__)(?=\S)(.+?[*_]*)(?=\S)\2(?=[^\w*]|$)/g, "$1<strong>$3</strong>");
							return text;
						}
					};
				}
				converter.setOptions(converterOptions);

				if (options) {
					$window.Markdown.Extra.init(converter, {
						extensions: options.extensions,
						highlighter: 'prettify'
					});

					if (options.syntaxHighlighting) {
						clEditorSvc.onAsyncPreview(function(cb) {
							Array.prototype.forEach.call(document.querySelectorAll('.prettyprint > code'), function(elt) {
								!elt.highlighted && $window.Prism.highlightElement(elt);
								elt.highlighted = true;
							});
							cb();
						});
					}
				}

				// Add email conversion to links
				converter.hooks.chain("postConversion", function(text) {
					return text.replace(/<(mailto\:)?([^\s>]+@[^\s>]+\.\S+?)>/g, function(match, mailto, email) {
						return '<a href="mailto:' + email + '">' + email + '</a>';
					});
				});

				clEditorSvc.setPrismOptions({
					fcbs: hasExtension('fenced_code_gfm'),
					tables: hasExtension('tables'),
					footnotes: hasExtension('footnotes'),
					strikes: hasExtension('strikethrough'),
					toc: options && options.toc
				});

				options && options.toc && clEditorSvc.onAsyncPreview(function(cb) {
					// Build the TOC
					var elementList = [];
					Array.prototype.forEach.call(previewElt.querySelectorAll('h1, h2, h3, h4, h5, h6'), function(elt) {
						elementList.push(new TocElement(elt.tagName, elt.id, elt.textContent));
					});
					var divElt = document.createElement('div');
					divElt.className = 'toc';
					var ulElt = document.createElement('ul');
					divElt.appendChild(ulElt);
					groupTags(elementList).forEach(function(tocElement) {
						ulElt.appendChild(tocElement.toElement());
					});

					// Replace toc paragraphs
					Array.prototype.slice.call(previewElt.getElementsByTagName('p')).forEach(function(elt) {
						if (tocRegExp.test(elt.innerHTML)) {
							elt.innerHTML = '';
							elt.appendChild(divElt.cloneNode(true));
						}
					});

					cb();
				});
			});


			// TOC element description
			function TocElement(tagName, anchor, text) {
				this.tagName = tagName;
				this.anchor = anchor;
				this.text = text;
				this.children = [];
			}

			TocElement.prototype.toElement = function() {
				var liElt = document.createElement('li');
				if (this.anchor && this.text) {
					var aElt = document.createElement('a');
					aElt.href = '#' + this.anchor;
					aElt.textContent = this.text;
					liElt.appendChild(aElt);
				}
				if (this.children.length !== 0) {
					var ulElt = document.createElement('ul');
					this.children.forEach(function(child) {
						ulElt.appendChild(child.toElement());
					});
					liElt.appendChild(ulElt);
				}
				return liElt;
			};

			// Transform flat list of TocElement into a tree
			function groupTags(array, level) {
				level = level || 1;
				var tagName = "H" + level;
				var result = [];

				var currentElement;

				function pushCurrentElement() {
					if (currentElement.children.length > 0) {
						currentElement.children = groupTags(currentElement.children, level + 1);
					}
					result.push(currentElement);
				}

				array.forEach(function(element) {
					if (element.tagName != tagName) {
						if (level !== options.tocMaxDepth) {
							currentElement = currentElement || new TocElement();
							currentElement.children.push(element);
						}
					} else {
						currentElement && pushCurrentElement();
						currentElement = element;
					}
				});
				currentElement && pushCurrentElement();
				return result;
			}

			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
					previewElt = element[0];

					function checkOptions() {
						var fileProperties = scope.currentFileDao.contentDao.properties;
						var newOptions = fileProperties['ext:mdextra'] !== '0' ? (function() {
							var extensions = [];
							fileProperties['ext:mdextra:fcb'] !== '0' && extensions.push('fenced_code_gfm');
							fileProperties['ext:mdextra:tables'] !== '0' && extensions.push('tables');
							fileProperties['ext:mdextra:deflist'] !== '0' && extensions.push('def_list');
							fileProperties['ext:mdextra:attrlist'] !== '0' && extensions.push('attr_list');
							fileProperties['ext:mdextra:footnotes'] !== '0' && extensions.push('footnotes');
							fileProperties['ext:mdextra:smartypants'] !== '0' && extensions.push('smartypants');
							fileProperties['ext:mdextra:strikethrough'] !== '0' && extensions.push('strikethrough');
							fileProperties['ext:mdextra:newlines'] !== '0' && extensions.push('newlines');
							var tocMaxDepth = parseInt(fileProperties['ext:mdextra:tocmaxdepth']);
							tocMaxDepth = isNaN(tocMaxDepth) ? 6 : tocMaxDepth;
							return {
								extensions: extensions,
								intraword: fileProperties['ext:mdextra:intraword'] !== '0',
								toc: fileProperties['ext:mdextra:toc'] !== '0',
								tocMaxDepth: tocMaxDepth,
								syntaxHighlighting: true
							};
						})() : undefined;
						if (JSON.stringify(newOptions) !== JSON.stringify(options)) {
							options = newOptions;
							return true;
						}
					}

					checkOptions();
					scope.$watch('currentFileDao.contentDao.properties', function(properties) {
						if (properties && checkOptions()) {
							clEditorSvc.initConverter();
						}
					});
				}
		});
