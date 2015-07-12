angular.module('classeur.extensions.markdown', [])
	.directive('clMarkdown',
		function($window, clEditorSvc, Slug) {
			var options = {};
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

			clEditorSvc.onMarkdownInit(0, function(markdown) {
				markdown.set({
					html: true,
					breaks: !!options.breaks,
					linkify: !!options.linkify,
					typographer: !!options.typographer,
					langPrefix: 'prism language-'
				});

				markdown.core.ruler.enable(Object.keys(options).reduce(function(rules, key) {
					return rules.concat(options[key] && coreRules.indexOf(key) !== -1 ? key : []);
				}, coreBaseRules));
				markdown.block.ruler.enable(Object.keys(options).reduce(function(rules, key) {
					return rules.concat(options[key] && blockRules.indexOf(key) !== -1 ? key : []);
				}, blockBaseRules));
				markdown.inline.ruler.enable(Object.keys(options).reduce(function(rules, key) {
					return rules.concat(options[key] && inlineRules.indexOf(key) !== -1 ? key : []);
				}, inlineBaseRules));

				markdown.core.ruler.push('anchors', function(state) {
					function getContent(token) {
						return token.children ? token.children.reduce(function(result, child) {
							return result + getContent(child);
						}, '') : token.content || '';
					}
					var anchorHash = {};
					var headingOpenToken, headingContent;
					state.tokens.forEach(function(token) {
						if (token.type === 'heading_open') {
							headingContent = '';
							headingOpenToken = token;
						} else if (token.type === 'heading_close') {
							headingOpenToken.headingContent = headingContent;
							var slug = Slug.slugify(headingContent) || 'heading';
							var anchor = slug;
							var index = 0;
							while (anchorHash.hasOwnProperty(anchor)) {
								anchor = slug + '-' + (++index);
							}
							anchorHash[anchor] = true;
							headingOpenToken.headingAnchor = anchor;
							headingOpenToken = undefined;
						} else if (headingOpenToken) {
							headingContent += getContent(token);
						}
					});
				});

				markdown.renderer.rules.heading_open = function(tokens, idx) {
					return tokens[idx].headingAnchor ? '<h' + tokens[idx].hLevel + ' id="' + tokens[idx].headingAnchor + '">' : '<h' + tokens[idx].hLevel + '>';
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
						level: state.level
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
						result += '<ul>' + this.children.map(function(item) {
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
					array.forEach(function(item) {
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
					state.tokens.forEach(function(token) {
						if (token.type === 'toc') {
							if (!tocContent) {
								var tocItems = [];
								state.tokens.forEach(function(token) {
									token.headingAnchor && tocItems.push(new TocItem(token.hLevel, token.headingAnchor, token.headingContent));
								});
								tocItems = groupTocItems(tocItems);
								tocContent = '<div class="toc">';
								if (tocItems.length) {
									tocContent += '<ul>' + tocItems.map(function(item) {
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
					var n = Number(tokens[idx].id + 1).toString();
					var id = 'fnref' + n;
					if (tokens[idx].subId > 0) {
						id += ':' + tokens[idx].subId;
					}
					return '<sup class="footnote-ref"><a href="#fn' + n + '" id="' + id + '">' + n + '</a></sup>';
				};

				clEditorSvc.setPrismOptions({
					fences: options.fences,
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
					Array.prototype.forEach.call(clEditorSvc.previewElt.querySelectorAll('pre > code.prism'), function(elt) {
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
					var tocMaxDepth = parseInt(fileProperties['ext:mdextra:tocmaxdepth']);
					var newOptions = {
						fences: fileProperties['ext:markdown:fences'] !== '0',
						table: fileProperties['ext:markdown:table'] !== '0',
						deflist: fileProperties['ext:markdown:deflist'] !== '0',
						del: fileProperties['ext:markdown:del'] !== '0',
						sub: fileProperties['ext:markdown:sub'] !== '0',
						sup: fileProperties['ext:markdown:sup'] !== '0',
						footnote: fileProperties['ext:markdown:footnote'] !== '0',
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
