angular.module('classeur.extensions.markdown', [])
	.directive('clMarkdown',
		function($window, clEditorSvc) {
			var options = {};
			var coreBaseRules = [
					'normalize',
					'block',
					'inline',
					'linkify',
					'replacements',
					'smartquotes',
				],
				blockBaseRules = [
					'code',
					'blockquote',
					'hr',
					'list',
					'reference',
					'heading',
					'lheading',
					'html_block',
					'paragraph',
				],
				inlineBaseRules = [
					'text',
					'newline',
					'escape',
					'backticks',
					'strikethrough',
					'emphasis',
					'link',
					'image',
					'autolink',
					'html_inline',
					'entity',
				],
				blockRules = [
					'fence',
					'table'
				];

			clEditorSvc.onMarkdownInit(0, function(markdown) {
				markdown.set({
					html: true,
					breaks: !!options.breaks,
					linkify: !!options.linkify,
					typographer: !!options.typographer,
					langPrefix: 'prism language-'
				});

				markdown.core.ruler.enable(coreBaseRules);
				markdown.block.ruler.enable(options.cl_reduce(function(rules, value, key) {
					return rules.concat(value && blockRules.indexOf(key) !== -1 ? key : []);
				}, blockBaseRules));
				markdown.inline.ruler.enable(inlineBaseRules);
				options.abbr && markdown.use($window.markdownitAbbr);
				options.deflist && markdown.use($window.markdownitDeflist);
				options.footnote && markdown.use($window.markdownitFootnote);
				options.sub && markdown.use($window.markdownitSub);
				options.sup && markdown.use($window.markdownitSup);

				markdown.core.ruler.before('replacements', 'anchors', function(state) {
					var anchorHash = {};
					var headingOpenToken, headingContent;
					state.tokens.cl_each(function(token) {
						if (token.type === 'heading_open') {
							headingContent = '';
							headingOpenToken = token;
						} else if (token.type === 'heading_close') {
							headingOpenToken.headingContent = headingContent;

							// Slugify according to http://pandoc.org/README.html#extension-auto_identifiers
							var slug = headingContent
								.replace(/\s/g, '-') // Replace all spaces and newlines with hyphens
								.replace(/[\0-,\/:-@[-^`{-~]/g, '') // Remove all punctuation, except underscores, hyphens, and periods
								.toLowerCase(); // Convert all alphabetic characters to lowercase

							// Remove everything up to the first letter
							for (var i = 0; i < slug.length; i++) {
								var charCode = slug.charCodeAt(i);
								if ((charCode >= 0x61 && charCode <= 0x7A) || charCode > 0x7E) {
									break;
								}
							}
							
							// If nothing is left after this, use the identifier `section`
							slug = slug.slice(i) || 'section';

							var anchor = slug;
							var index = 1;
							while (anchorHash.hasOwnProperty(anchor)) {
								anchor = slug + '-' + (index++);
							}
							anchorHash[anchor] = true;
							headingOpenToken.headingAnchor = anchor;
							headingOpenToken = undefined;
						} else if (headingOpenToken) {
							headingContent += token.children.cl_reduce(function(result, child) {
								if (child.type !== 'footnote_ref') {
									result += child.content;
								}
								return result;
							}, '');
						}
					});
				});

				var originalHeadingOpen = markdown.renderer.rules.heading_open;
				markdown.renderer.rules.heading_open = function(tokens, idx) {
					var token = tokens[idx];
					(token.attrs = token.attrs || []).push(['id', token.headingAnchor]);
					if (originalHeadingOpen) {
						return originalHeadingOpen.apply(this, arguments);
					} else {
						return markdown.renderer.renderToken.apply(markdown.renderer, arguments);
					}
				};

				options.toc && markdown.block.ruler.before('paragraph', 'toc', function(state, startLine, endLine, silent) {
					var pos = state.bMarks[startLine] + state.tShift[startLine],
						max = state.eMarks[startLine];
					if (
						max - pos !== 5 ||
						state.src.charCodeAt(pos) !== 0x5B /* [ */ ||
						state.src.charCodeAt(pos + 4) !== 0x5D /* ] */ ||
						state.src.slice(pos + 1, pos + 4).toLowerCase() !== 'toc'
					) {
						return false;
					}
					if (silent) {
						return true;
					}
					state.line = startLine + 1;
					state.tokens.push({
						type: 'toc',
						level: state.level,
						map: [startLine, endLine]
					});
					return true;
				});

				function TocItem(level, anchor, text) {
					this.level = level;
					this.anchor = anchor;
					this.text = text;
					this.children = [];
				}

				TocItem.prototype.toString = function() {
					var result = '<li>';
					if (this.anchor && this.text) {
						result += '<a href="#' + this.anchor + '">' + this.text + '</a>';
					}
					if (this.children.length !== 0) {
						result += '<ul>' + this.children.cl_map(function(item) {
							return item.toString();
						}).join('') + '</ul>';
					}
					return result + '</li>';
				};

				// Transform a flat list of TocItems into a tree
				function groupTocItems(array, level) {
					level = level || 1;
					var result = [],
						currentItem;

					function pushCurrentItem() {
						if (currentItem.children.length > 0) {
							currentItem.children = groupTocItems(currentItem.children, level + 1);
						}
						result.push(currentItem);
					}
					array.cl_each(function(item) {
						if (item.level !== level) {
							if (level !== options.tocMaxDepth) {
								currentItem = currentItem || new TocItem();
								currentItem.children.push(item);
							}
						} else {
							currentItem && pushCurrentItem();
							currentItem = item;
						}
					});
					currentItem && pushCurrentItem();
					return result;
				}

				options.toc && markdown.core.ruler.push('toc_builder', function(state) {
					var tocContent;
					state.tokens.cl_each(function(token) {
						if (token.type === 'toc') {
							if (!tocContent) {
								var tocItems = [];
								state.tokens.cl_each(function(token) {
									token.headingAnchor && tocItems.push(new TocItem(
										token.tag.charCodeAt(1) - 0x30,
										token.headingAnchor,
										token.headingContent
									));
								});
								tocItems = groupTocItems(tocItems);
								tocContent = '<div class="toc">';
								if (tocItems.length) {
									tocContent += '<ul>' + tocItems.cl_map(function(item) {
										return item.toString();
									}).join('') + '</ul>';
								}
								tocContent += '</div>';
							}
							token.content = tocContent;
						}
					});
				});

				markdown.renderer.rules.toc = function(tokens, idx) {
					return tokens[idx].content;
				};

				markdown.renderer.rules.footnote_ref = function(tokens, idx) {
					var n = Number(tokens[idx].meta.id + 1).toString();
					var id = 'fnref' + n;
					if (tokens[idx].meta.subId > 0) {
						id += ':' + tokens[idx].meta.subId;
					}
					return '<sup class="footnote-ref"><a href="#fn' + n + '" id="' + id + '">' + n + '</a></sup>';
				};

				clEditorSvc.setPrismOptions({
					fences: options.fence,
					tables: options.table,
					footnotes: options.footnote,
					abbrs: options.abbr,
					deflists: options.deflist,
					dels: options.del,
					subs: options.sub,
					sups: options.sup,
					tocs: options.toc
				});

				clEditorSvc.onAsyncPreview(function(cb) {
					clEditorSvc.previewElt.querySelectorAll('pre > code.prism').cl_each(function(elt) {
						!elt.highlighted && $window.Prism.highlightElement(elt);
						elt.highlighted = true;
					});
					cb();
				});
			});

			return {
				restrict: 'A',
				link: link
			};

			function link(scope) {
				function checkOptions() {
					var fileProperties = scope.currentFileDao.contentDao.properties;
					var tocMaxDepth = parseInt(fileProperties['ext:markdown:tocmaxdepth']);
					var newOptions = {
						abbr: fileProperties['ext:markdown:abbr'] !== 'false',
						breaks: fileProperties['ext:markdown:breaks'] !== 'false',
						deflist: fileProperties['ext:markdown:deflist'] !== 'false',
						del: fileProperties['ext:markdown:del'] !== 'false',
						fence: fileProperties['ext:markdown:fence'] !== 'false',
						footnote: fileProperties['ext:markdown:footnote'] !== 'false',
						linkify: fileProperties['ext:markdown:linkify'] !== 'false',
						sub: fileProperties['ext:markdown:sub'] !== 'false',
						sup: fileProperties['ext:markdown:sup'] !== 'false',
						table: fileProperties['ext:markdown:table'] !== 'false',
						typographer: fileProperties['ext:markdown:typographer'] !== 'false',
						toc: fileProperties['ext:markdown:toc'] !== 'false',
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
