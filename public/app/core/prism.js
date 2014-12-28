angular.module('classeur.core.prism', [])
	.factory('prism', function() {

		var charInsideUrl = "(&amp;|[-A-Z0-9+@#/%?=~_|[\\]()!:,.;])",
			charEndingUrl = "(&amp;|[-A-Z0-9+@#/%=~_|[\\])])";
		var urlPattern = new RegExp("(https?|ftp)(://" + charInsideUrl + "*" + charEndingUrl + ")(?=$|\\W)", "gi");
		var emailPattern = /(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)/gi;

		var markup = {
			'comment': /&lt;!--[\w\W]*?-->/g,
			'tag': {
				pattern: /&lt;\/?[\w:-]+\s*(?:\s+[\w:-]+(?:=(?:("|')(\\?[\w\W])*?\1|[^\s'">=]+))?\s*)*\/?>/gi,
				inside: {
					'tag': {
						pattern: /^&lt;\/?[\w:-]+/i,
						inside: {
							'punctuation': /^&lt;\/?/,
							'namespace': /^[\w-]+?:/
						}
					},
					'attr-value': {
						pattern: /=(?:('|")[\w\W]*?(\1)|[^\s>]+)/gi,
						inside: {
							'punctuation': /=|>|"/g
						}
					},
					'punctuation': /\/?>/g,
					'attr-name': {
						pattern: /[\w:-]+/g,
						inside: {
							'namespace': /^[\w-]+?:/
						}
					}

				}
			},
			'entity': /&amp;#?[\da-z]{1,8};/gi
		};

		var latex = {
			// A tex command e.g. \foo
			'keyword': /\\(?:[^a-zA-Z]|[a-zA-Z]+)/g,
			// Curly and square braces
			'lparen': /[[({]/g,
			// Curly and square braces
			'rparen': /[\])}]/g,
			// A comment. Tex comments start with % and go to
			// the end of the line
			'comment': /%.*/g
		};

		return function(options) {
			options = options || {};
			var md = {};
			if(options.fcbs) {
				md['pre gfm'] = {
					pattern: /^`{3}.*\n(?:[\s\S]*?)\n`{3} *$/gm,
					inside: {
						"md md-pre": /`{3}/
					}
				};
			}
			md['h1 alt'] = {
				pattern: /^(.+)[ \t]*\n=+[ \t]*$/gm,
				inside: {
					"md md-hash": /=+[ \t]*$/
				}
			};
			md['h2 alt'] = {
				pattern: /^(.+)[ \t]*\n-+[ \t]*$/gm,
				inside: {
					"md md-hash": /-+[ \t]*$/
				}
			};
			for(var i = 6; i >= 1; i--) {
				md["h" + i] = {
					pattern: new RegExp("^#{" + i + "}.+$", "gm"),
					inside: {
						"md md-hash": new RegExp("^#{" + i + "}")
					}
				};
			}
			md.li = {
				pattern: /^[ \t]*([*+\-]|\d+\.)[ \t].+(?:\n|[ \t].*\n)*/gm,
				inside: {
					"md md-li": /^[ \t]*([*+\-]|\d+\.)[ \t]/m,
					'pre gfm': {
						pattern: /^((?: {4}|\t)+)`{3}.*\n(?:[\s\S]*?)\n\1`{3} *$/gm,
						inside: {
							"md md-pre": /`{3}/
						}
					}
				}
			};
			md.pre = {
				pattern: /(^|(?:^|(?:^|\n)(?![ \t]*([*+\-]|\d+\.)[ \t]).*\n)\s*?\n)(\s*(?: {4}|\t).*(?:\n|$))+/g,
				lookbehind: true
			};
			if(options.tables) {
				md.table = {
					pattern: new RegExp(
						[
							'^'                         ,
							'[ ]{0,3}'                  , // Allowed whitespace
							'[|]'                       , // Initial pipe
							'(.+)\\n'                   , // $1: Header Row

							'[ ]{0,3}'                  , // Allowed whitespace
							'[|]([ ]*[-:]+[-| :]*)\\n'  , // $2: Separator

							'('                         , // $3: Table Body
							'(?:[ ]*[|].*\\n?)*'      , // Table rows
							')',
							'(?:\\n|$)'                   // Stop at final newline
						].join(''),
						'gm'
					),
					inside: {}
				};
				md['table alt'] = {
					pattern: new RegExp(
						[
							'^'                         ,
							'[ ]{0,3}'                  , // Allowed whitespace
							'(\\S.*[|].*)\\n'           , // $1: Header Row

							'[ ]{0,3}'                  , // Allowed whitespace
							'([-:]+[ ]*[|][-| :]*)\\n'  , // $2: Separator

							'('                         , // $3: Table Body
							'(?:.*[|].*\\n?)*'        , // Table rows
							')'                         ,
							'(?:\\n|$)'                   // Stop at final newline
						].join(''),
						'gm'
					),
					inside: {}
				};
			}

			md.hr = {
				pattern: /^([*\-_] *){3,}$/gm
			};
			md.blockquote = {
				pattern: /^ {0,3}> *[^\n]+$/gm,
				inside: {
					"md md-gt": /^ {0,3}> */,
					"li": md.li
				}
			};
			if(options.maths) {
				md['math block'] = {
					pattern: /(\$\$|\\\\\[|\\\\\\\\\()[\s\S]*?(\$\$|\\\\\]|\\\\\\\\\))/g,
					inside: {
						"md md-bracket-start": /^(\$\$|\\\\\[|\\\\\\\\\()/,
						"md md-bracket-end": /(\$\$|\\\\\]|\\\\\\\\\))/,
						rest: latex
					}
				};
				md['latex block'] = {
					pattern: /\\?\\begin\{([a-z]*\*?)\}[\s\S]*?\\?\\end\{\1\}/g,
					inside: {
						"keyword": /\\?\\(begin|end)/,
						rest: latex
					}
				};
			}
			if(options.footnotes) {
				md.fndef = {
					pattern: /^ {0,3}\[\^.*?\]:[ \t]+.*$/gm,
					inside: {
						"ref-id": {
							pattern: /\[\^.*?\]/,
							inside: {
								"md md-bracket-start": /\[/,
								"md md-bracket-end": /\]/
							}
						}
					}
				};
			}
			md.linkdef = {
				pattern: /^ {0,3}\[.*?\]:[ \t]+.*$/gm,
				inside: {
					"link-id": {
						pattern: /\[.*?\]/,
						inside: {
							"md md-bracket-start": /\[/,
							"md md-bracket-end": /\]/
						}
					},
					url: urlPattern,
					linktitle: /['\"\(][^\'\"\)]*['\"\)]/
				}
			};
			md.p = {
				pattern: /.+/g,
				inside: {}
			};
			if(options.toc) {
				md.p.inside['md md-toc'] = /^\s*\[(toc|TOC)\]\s*$/g;
			}
			md.img = {
				pattern: /!\[[^\]]*\]\([^\)]+\)/g,
				inside: {
					"md md-bang": /^!/,
					"md md-bracket-start": /\[/,
					"md md-alt": /[^\[]+(?=\])/,
					"md md-bracket-end": /\](?=\()/,
					"md img-parens": {
						pattern: /\([^\)]+\)/,
						inside: {
							"md md-paren-start": /^\(/,
							"md md-title": /(['‘][^'’]*['’]|["“][^"”]*["”])(?=\)$)/,
							"md md-src": /[^\('" \t]+(?=[\)'" \t])/,
							"md md-paren-end": /\)$/
						}
					}
				}
			};
			md.link = {
				pattern: /\[(?:(\\.)|[^\[\]])*\]\([^\(\)\s]+(\(\S*?\))??[^\(\)\s]*?(\s(['‘][^'’]*['’]|["“][^"”]*["”]))?\)/gm,
				inside: {
					"md md-bracket-start": {
						pattern: /(^|[^\\])\[/,
						lookbehind: true
					},
					"md md-underlined-text": {
						pattern: /(?:(\\.)|[^\[\]])+(?=\])/
					},
					"md md-bracket-end": /\]\s?\(/,
					"md md-paren-end": /\)$/,
					"md md-href": /.*/
				}
			};
			if(options.footnotes) {
				md.fn = {
					pattern: /\[\^(.*?)\]/g,
					inside: {
						"ref": {
							pattern: /^\[[^\[\]]+\] ?/,
							inside: {
								"md md-bracket-start": /\[/,
								"md md-ref": /^[^\[\]]+/,
								"md md-bracket-end": /\]/
							}
						}
					}
				};
			}
			md.imgref = {
				pattern: /!\[(.*?)\] ?\[(.*?)\]/g,
				inside: {
					"md md-bang": /^!/,
					"ref-end": {
						pattern: /\[[^\[\]]+\]$/,
						inside: {
							"md md-bracket-start": /\[/,
							"md md-href": /[^\[\]]+(?=]$)/,
							"md md-bracket-end": /\]/
						}
					},
					"ref-start": {
						pattern: /^\[[^\[\]]+\] ?/,
						inside: {
							"md md-bracket-start": /\[/,
							"md md-alt": /^[^\[\]]+/,
							"md md-bracket-end": /\]/
						}
					}
				}
			};
			md.linkref = {
				pattern: /\[(.*?)\] ?\[(.*?)\]/g,
				inside: {
					"ref-end": {
						pattern: /\[[^\[\]]+\]$/,
						inside: {
							"md md-bracket-start": /\[/,
							"md md-href": /[^\[\]]+(?=]$)/,
							"md md-bracket-end": /\]/
						}
					},
					"ref-start": {
						pattern: /^\[[^\[\]]+\] ?/,
						inside: {
							"md md-bracket-start": /\[/,
							"md md-underlined-text": /^[^\[\]]+/,
							"md md-bracket-end": /\]/
						}
					}
				}
			};
			md.code = {
				pattern: /(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/g,
				lookbehind: true,
				inside: {
					"md md-code": /`/
				}
			};
			if(options.maths) {
				md.math = {
					pattern: /\$.*?\$/g,
					inside: {
						"md md-bracket-start": /^\$/,
						"md md-bracket-end": /\$$/,
						rest: latex
					}
				};
			}
			md.strong = {
				pattern: /([_\*])\1((?!\1{2}).)*\1{2}/g,
				inside: {
					"md md-strong": /([_\*])\1/g
				}
			};
			md.em = {
				pattern: /(^|[^\\])(\*|_)(\S[^\2]*?)??[^\s\\]+?\2/g,
				lookbehind: true,
				inside: {
					"md md-em md-start": /^(\*|_)/,
					"md md-em md-close": /(\*|_)$/
				}
			};
			if(options.strikes) {
				md.strike = {
					pattern: /(^|\n|\W)(~~)(?=\S)([^\r]*?\S)\2/gm,
					lookbehind: true,
					inside: {
						"md md-s": /(~~)/,
						"md-strike-text": /[^~]+/
					}
				};
			}
			var rest = {
				code: md.code,
				math: md.math,
				fn: md.fn,
				img: md.img,
				link: md.link,
				imgref: md.imgref,
				linkref: md.linkref,
				url: urlPattern,
				email: emailPattern,
				strong: md.strong,
				em: md.em,
				strike: md.strike,
				comment: markup.comment,
				tag: markup.tag,
				entity: markup.entity
			};

			for(var c = 6; c >= 1; c--) {
				md["h" + c].inside.rest = rest;
			}
			md["h1 alt"].inside.rest = rest;
			md["h2 alt"].inside.rest = rest;
			if(options.tables) {
				md.table.inside.rest = rest;
				md["table alt"].inside.rest = rest;
			}
			md.p.inside.rest = rest;
			md.blockquote.inside.rest = rest;
			md.li.inside.rest = rest;
			if(options.footnotes) {
				md.fndef.inside.rest = rest;
			}

			rest = {
				code: md.code,
				fn: md.fn,
				link: md.link,
				linkref: md.linkref
			};
			md.strong.inside.rest = rest;
			md.em.inside.rest = rest;
			if(options.strikes) {
				md.strike.inside.rest = rest;
			}

			var inside = {
				code: md.code,
				strong: md.strong,
				em: md.em,
				strike: md.strike,
				comment: markup.comment,
				tag: markup.tag,
				entity: markup.entity
			};
			md.link.inside["md md-underlined-text"].inside = inside;
			md.linkref.inside["ref-start"].inside["md md-underlined-text"].inside = inside;

			return md;
		};
	});
