angular.module('classeur.extensions.stat', [])
	.directive('clStat', function(clEditorSvc, clPanel, clSelectionListeningSvc) {
		function Stat(name, regex) {
			this.name = name;
			this.regex = new RegExp(regex, 'gm');
		}

		var markdownStats = [
			new Stat('bytes', '[\\s\\S]'),
			new Stat('words', '\\S+'),
			new Stat('lines', '\n'),
		];

		var htmlStats = [
			new Stat('characters', '\\S'),
			new Stat('words', '\\S+'),
			new Stat('paragraphs', '\\S.*\n'),
		];

		var Hammer = window.Hammer;
		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'app/extensions/stat/stat.html',
			link: function(scope, element) {
				scope.markdownStats = markdownStats;
				scope.htmlStats = htmlStats;
				scope.editor = clEditorSvc;
				scope.selectionListener = clSelectionListeningSvc;

				var x = 0, y = -130;
				var statPanel = clPanel(element, '.stat.panel');
				statPanel.move().rotate(-1.5)
					.then().to(x, y).duration(180).ease('ease-out-back').pop()
					.end();

				var hammertime = new Hammer(element[0]);
				hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 0 });
				hammertime.on('panmove', function(evt) {
					evt.preventDefault();
					statPanel.move().rotate(-1.5).to(x + evt.deltaX, y + evt.deltaY).end();
				});
				hammertime.on('panend', function(evt) {
					x += evt.deltaX;
					y += evt.deltaY;
				});

				function computeMarkdown() {
					scope.isMarkdownSelection = false;
					var text = clEditorSvc.cledit.getContent();
					var selectedText = clEditorSvc.cledit.selectionMgr.getSelectedText();
					if(selectedText) {
						scope.isMarkdownSelection = true;
						text = selectedText;
					}
					markdownStats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				}

				function computeHtml() {
					var text;
					if(clSelectionListeningSvc.range &&
						(clEditorSvc.previewElt.compareDocumentPosition(clSelectionListeningSvc.range.startContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY) &&
						(clEditorSvc.previewElt.compareDocumentPosition(clSelectionListeningSvc.range.endContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
						text = '' + clSelectionListeningSvc.range;
					}
					if(text) {
						scope.isHtmlSelection = true;
					}
					else {
						scope.isHtmlSelection = false;
						text = clEditorSvc.previewText;
					}
					htmlStats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				}

				scope.$watch('editorSvc.sectionList', computeMarkdown);
				scope.$watch('editorSvc.selectionRange', computeMarkdown);
				scope.$watch('editor.previewText', computeHtml);
				scope.$watch('selectionListener.range', computeHtml);
			}
		};
	});
