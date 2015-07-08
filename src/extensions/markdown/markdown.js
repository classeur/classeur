angular.module('classeur.extensions.markdown', [])
	.directive('clMarkdown',
		function($window, clEditorSvc) {

			var options = {};
			var previewElt;
			var tocRegExp = /^\s*\[(TOC|toc)\]\s*$/;

			var coreBaseRules = [
					'block',
					'references',
					'inline',
					'footnote_tail',
					'abbr2',
					'replacements',
					'smartquotes',
					'linkify'
				],
				blockBaseRules = [
					'blockquote',
					'code',
					'heading',
					'hr',
					'htmlblock',
					'lheading',
					'list',
					'paragraph',
				],
				inlineBaseRules = [
					'autolink',
					'backticks',
					'emphasis',
					'entity',
					'escape',
					'footnote_ref',
					'htmltag',
					'links',
					'newline',
					'text'
				],
				coreRules = [
					'abbr',
				],
				blockRules = [
					'fences',
					'table',
					'footnote',
					'deflist'
				],
				inlineRules = [
					'footnote_inline',
					'del',
					'sub',
					'sup'
				];

			clEditorSvc.onMarkdownInit(50, function(markdown) {
				markdown.set({
					html: true,
					breaks: !!options.breaks,
					linkify: !!options.linkify,
					typographer: !!options.typographer,
					langPrefix: 'prism language-'
				});

				markdown.core.ruler.enable(Object.keys(options).reduce(function(rules, key) {
					return rules.concat(options[key] && coreRules.indexOf(key) !== -1 ? key : []);
				}, coreBaseRules), true);
				markdown.block.ruler.enable(Object.keys(options).reduce(function(rules, key) {
					return rules.concat(options[key] && blockRules.indexOf(key) !== -1 ? key : []);
				}, blockBaseRules), true);
				markdown.inline.ruler.enable(Object.keys(options).reduce(function(rules, key) {
					return rules.concat(options[key] && inlineRules.indexOf(key) !== -1 ? key : []);
				}, inlineBaseRules), true);

				markdown.block.ruler.before('paragraph', 'toc', function(state, startLine, endLine, silent) {
					console.log(state);
				});

				clEditorSvc.setPrismOptions({
					fcbs: options.fences,
					tables: options.table,
					footnotes: options.footnote,
					strikes: options.del,
					toc: options.toc
				});

				clEditorSvc.onAsyncPreview(function(cb) {
					Array.prototype.forEach.call(clEditorSvc.previewElt.querySelectorAll('pre > code.prism'), function(elt) {
						!elt.highlighted && $window.Prism.highlightElement(elt);
						elt.highlighted = true;
					});
					cb();
				});
			});

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
				}

				// Add email conversion to links
				converter.hooks.chain("postConversion", function(text) {
					return text.replace(/<(mailto\:)?([^\s>]+@[^\s>]+\.\S+?)>/g, function(match, mailto, email) {
						return '<a href="mailto:' + email + '">' + email + '</a>';
					});
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
					var tocMaxDepth = parseInt(fileProperties['ext:mdextra:tocmaxdepth']);
					var newOptions = {
						fences: fileProperties['ext:markdown:fences'] !== '0',
						table: fileProperties['ext:markdown:table'] !== '0',
						deflist: fileProperties['ext:markdown:deflist'] !== '0',
						del: fileProperties['ext:markdown:del'] !== '0',
						sub: fileProperties['ext:markdown:sub'] !== '0',
						sup: fileProperties['ext:markdown:sup'] !== '0',
						footnote_inline: fileProperties['ext:markdown:footnote'] !== '0',
						abbr: fileProperties['ext:markdown:abbr'] !== '0',
						breaks: fileProperties['ext:markdown:breaks'] !== '0',
						linkify: fileProperties['ext:markdown:linkify'] !== '0',
						typographer: fileProperties['ext:markdown:typographer'] !== '0',
						toc: fileProperties['ext:markdown:toc'] !== '0',
						tocMaxDepth: isNaN(tocMaxDepth) ? 6 : tocMaxDepth,
					};
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
