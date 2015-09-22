angular.module('classeur.optional.urlDialog', [])
	.directive('clImageDropInput',
		function($http, clToast, clDialog) {
			var maxSize = 20000000;
			return {
				restrict: 'A',
				link: function(scope, element) {
					function uploadFile(file) {
						var reader = new FileReader();
						reader.onload = function(e) {
							var bytes = new Uint8Array(e.target.result);
							var len = bytes.byteLength;
							if (len === maxSize) {
								return clToast('Image is too big.');
							}
							var binary = '';
							for (var i = 0; i < len; i++) {
								binary += String.fromCharCode(bytes[i]);
							}
							var b64 = window.btoa(binary);
							var req = {
								method: 'POST',
								url: 'https://imgur-apiv3.p.mashape.com/3/image',
								headers: {
									'X-Mashape-Key': 'hpKe3bllNtmsha5BlevJqD1CZrghp1zp8ZfjsnCa7rgGkgEDF7',
									Authorization: 'Client-ID 7196cbab27137aa',

								},
								data: {
									image: b64,
									type: 'base64'
								}
							};

							scope.isUploading = true;
							$http(req)
								.success(function(result) {
									clDialog.hide(result.data.link.replace(/^http:/, 'https:'));
								})
								.error(function(err) {
									scope.isUploading = false;
									clToast(err.data.error);
								});
						};
						var blob = file.slice(0, maxSize);
						reader.readAsArrayBuffer(blob);
					}
					var elt = element[0];
					elt.addEventListener('change', function(evt) {
						var files = evt.target.files;
						files[0] && uploadFile(files[0]);
					});
					elt.addEventListener('dragover', function(evt) {
						evt.stopPropagation();
						evt.preventDefault();
						evt.dataTransfer.dropEffect = 'copy';
					});
					elt.addEventListener('dragover', function(evt) {
						evt.stopPropagation();
						evt.preventDefault();
						evt.dataTransfer.dropEffect = 'copy';
					});
					elt.addEventListener('drop', function(evt) {
						var files = (evt.dataTransfer || evt.target).files;
						if (files[0]) {
							evt.stopPropagation();
							evt.preventDefault();
							uploadFile(files[0]);
						}
					});
				}
			};
		})
	.directive('clUriDialog',
		function(clDialog, clEditorLayoutSvc, clEditorSvc) {
			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					if (currentControl === 'linkDialog') {
						clDialog.show({
							templateUrl: 'optional/urlDialog/linkDialog.html',
							controller: ['$scope', dialogCtrl],
							focusOnOpen: false
						}).then(function(url) {
							clEditorLayoutSvc.currentControl = undefined;
							clEditorSvc.linkDialogCallback && clEditorSvc.linkDialogCallback(url || null);
						}, function() {
							clEditorLayoutSvc.currentControl = undefined;
							clEditorSvc.linkDialogCallback && clEditorSvc.linkDialogCallback(null);
						});
					} else if (currentControl === 'imageDialog') {
						clDialog.show({
							templateUrl: 'optional/urlDialog/imageDialog.html',
							controller: ['$scope', dialogCtrl],
							focusOnOpen: false
						}).then(function(url) {
							clEditorLayoutSvc.currentControl = undefined;
							clEditorSvc.imageDialogCallback && clEditorSvc.imageDialogCallback(url || null);
						}, function() {
							clEditorLayoutSvc.currentControl = undefined;
							clEditorSvc.imageDialogCallback && clEditorSvc.imageDialogCallback(null);
						});
					}
				});
			}

			function dialogCtrl(scope) {
				scope.ok = function() {
					if (!scope.url) {
						return scope.focus();
					}
					clDialog.hide(scope.url);
				};
				scope.cancel = function() {
					clDialog.cancel();
				};
			}
		});
