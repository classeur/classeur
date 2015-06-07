angular.module('classeur.opt.exportToDisk', [])
	.directive('clExportToDisk', function($window, clDialog, clToast, clEditorLayoutSvc, clSocketSvc, clEditorSvc, clSettingSvc) {
		function saveAs(byteString, name, type) {
			var buffer = new ArrayBuffer(byteString.length);
			var view = new Uint8Array(buffer);
			for (var i = 0; i < byteString.length; i++) {
				view[i] = byteString.charCodeAt(i);
			}
			var blob = new Blob([view], {
				type: type
			});
			$window.saveAs(blob, name);
		}

		clSocketSvc.addMsgHandler('pdf', function(msg) {
			saveAs(atob(msg.pdf), msg.name, 'application/pdf');
		});

		var config = {
			format: 'markdown'
		};

		return {
			restrict: 'E',
			link: function(scope) {
				function showDialog() {
					function closeDialog() {
						clEditorLayoutSvc.currentControl = undefined;
					}
					clDialog.show({
						templateUrl: 'opt/exportToDisk/exportToDisk.html',
						onComplete: function(scope) {
							scope.config = config;
							scope.export = function() {
								clDialog.hide();
							};
							scope.cancel = function() {
								clDialog.cancel();
							};
						}
					}).then(function() {
						closeDialog();
						if (config.format === 'markdown') {
							saveAs(scope.currentFileDao.contentDao.text, scope.currentFileDao.name, 'text/plain');
						}
						else if (config.format === 'formatted') {
							saveAs(clEditorSvc.applyTemplate(clSettingSvc.values.exportTemplates['Styled HTML']), scope.currentFileDao.name, 'text/html');
						}
						else if (config.format === 'pdf') {
							var html = clEditorSvc.applyTemplate(clSettingSvc.values.exportTemplates.PDF);
							clToast('PDF is being prepared...');
							clSocketSvc.sendMsg({
								type: 'toPdf',
								name: scope.currentFileDao.name,
								html: html
							});
						}
					}, closeDialog);
				}

				scope.$watch('editorLayoutSvc.currentControl === "exportToDisk"', function(value) {
					value && showDialog();
				});
			}
		};
	});
