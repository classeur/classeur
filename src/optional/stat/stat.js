angular.module('classeur.optional.stat', [])
	.directive('clStat',
		function(clEditorSvc, clEditorLayoutSvc, clPanel, clSelectionListeningSvc) {
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
				new Stat('paragraphs', '\\S.*'),
			];

			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/stat/stat.html',
				link: link
			};

			function link(scope, element) {
				scope.markdownStats = markdownStats;
				scope.htmlStats = htmlStats;
				scope.editor = clEditorSvc;
				scope.selectionListener = clSelectionListeningSvc;

				var statPanel = clPanel(element, '.stat.panel');
				var speed;

				function move() {
					statPanel.move(speed).to(-clEditorLayoutSvc.backgroundX, clEditorLayoutSvc.isStatOpen ? 0 : 20).end();
					speed = 'slow';
				}

				function computeMarkdown() {
					scope.isMarkdownSelection = false;
					var text = clEditorSvc.cledit.getContent();
					var selectedText = clEditorSvc.cledit.selectionMgr.getSelectedText();
					if (selectedText) {
						scope.isMarkdownSelection = true;
						text = selectedText;
					}
					markdownStats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				}

				function computeHtml() {
					var text;
					if (clSelectionListeningSvc.range &&
						(clEditorSvc.previewElt.compareDocumentPosition(clSelectionListeningSvc.range.startContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY) &&
						(clEditorSvc.previewElt.compareDocumentPosition(clSelectionListeningSvc.range.endContainer) & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
						text = '' + clSelectionListeningSvc.range;
					}
					if (text) {
						scope.isHtmlSelection = true;
					} else {
						scope.isHtmlSelection = false;
						text = clEditorSvc.previewText;
					}
					text !== undefined && htmlStats.forEach(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				}

				scope.$watch('editorSvc.sectionList', computeMarkdown);
				scope.$watch('editorSvc.selectionRange', computeMarkdown);
				scope.$watch('editor.previewText', computeHtml);
				scope.$watch('selectionListener.range', computeHtml);
				scope.$watch('editorLayoutSvc.isStatOpen', move);
				scope.$watch('editorLayoutSvc.isTocOpen', move);
			}
		});
