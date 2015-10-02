angular.module('classeur.optional.stat', [])
	.directive('clStat',
		function(clEditorSvc, clEditorLayoutSvc, clLocalSettingSvc) {
			function Stat(name, regex) {
				this.name = name;
				this.regex = new RegExp(regex, 'gm');
			}

			var textStats = [
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
				scope.textStats = textStats;
				scope.htmlStats = htmlStats;
				scope.editor = clEditorSvc;

				var statPanelElt = element[0].querySelector('.stat.panel');
				var duration;

				function move() {
					statPanelElt.clanim
						.translateX(-clEditorLayoutSvc.backgroundX)
						.translateY(clLocalSettingSvc.values.stat ? 0 : 30)
						.duration(duration)
						.easing('materialOut')
						.start(true);
					duration = 300;
				}

				function computeText() {
					scope.isTextSelection = false;
					var text = clEditorSvc.cledit.getContent();
					var selectedText = clEditorSvc.cledit.selectionMgr.getSelectedText();
					if (selectedText) {
						scope.isTextSelection = true;
						text = selectedText;
					}
					textStats.cl_each(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				}

				function computeHtml() {
					var text;
					if (clEditorSvc.previewSelectionRange) {
						text = '' + clEditorSvc.previewSelectionRange;
					}
					if (text) {
						scope.isHtmlSelection = true;
					} else {
						scope.isHtmlSelection = false;
						text = clEditorSvc.previewText;
					}
					text !== undefined && htmlStats.cl_each(function(stat) {
						stat.value = (text.match(stat.regex) || []).length;
					});
				}

				scope.$watch('editorSvc.sectionList', computeText);
				scope.$watch('editorSvc.selectionRange', computeText);
				scope.$watch('editor.previewText', computeHtml);
				scope.$watch('editorSvc.previewSelectionRange', computeHtml);
				scope.$watch('localSettingSvc.values.stat', move);
				scope.$watch('localSettingSvc.values.sideBar', move);
			}
		});
