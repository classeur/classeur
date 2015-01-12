angular.module('classeur.extensions.urlDialog', [])
	.directive('clUriDialog', function($mdDialog, $http, toast, layout, editor) {
		var maxImageSize = 10000000;

		function onLinkDialog(scope, element) {

			scope.ok = function() {
				if(!scope.url) {
					return scope.focus();
				}
				$mdDialog.hide(scope.url);
			};
			scope.cancel = function() {
				$mdDialog.cancel();
			};

			var inputElt = element[0].querySelector('input');
			inputElt.addEventListener('keydown', function(e) {
				// Check enter key
				if(e.which !== 13) {
					return;
				}
				e.preventDefault();
				scope.ok();
			});
			scope.focus = function() {
				setTimeout(function() {
					inputElt.focus();
				}, 10);
			};
			scope.focus();

		}

		function onImageDialog(scope, element) {
			onLinkDialog(scope, element);

			var dropZoneElt = angular.element(element[0].querySelector('.drop-zone'));
			dropZoneElt.on('dragover', function(evt) {
				evt.stopPropagation();
				evt.preventDefault();
				evt.dataTransfer.dropEffect = 'copy';
			});
			dropZoneElt.on('drop', function(evt) {

				var files = (evt.dataTransfer || evt.target).files;
				var file = files[0];
				if(!file) {
					return;
				}
				evt.stopPropagation();
				evt.preventDefault();
				var reader = new FileReader();
				reader.onload = function(e) {
					var bytes = new Uint8Array(e.target.result);
					var len = bytes.byteLength;
					if(len === maxImageSize) {
						return toast('Image is too big.');
					}
					var binary = '';
					for(var i = 0; i < len; i++) {
						binary += String.fromCharCode(bytes[i]);
					}
					var b64 = window.btoa(binary);
					var req = {
						method: 'POST',
						url: 'https://imgur-apiv3.p.mashape.com/3/image',
						headers: {
							'X-Mashape-Key': 'XjXgvL6BjUmshULT58qibBNIgw4Lp1s7vQEjsnU0G9YgpviQzh',
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
							$mdDialog.hide(result.data.link);
						})
						.error(function(err) {
							scope.isUploading = false;
							toast(err.data.error);
						});
				};
				var blob = file.slice(0, maxImageSize);
				reader.readAsArrayBuffer(blob);

			});
		}

		return {
			restrict: 'E',
			link: function(scope) {
				scope.$watch('layout.currentControl', function(currentControl) {
					if(currentControl === 'linkDialog') {
						$mdDialog.show({
							templateUrl: 'app/extensions/urlDialog/linkDialog.html',
							onComplete: onLinkDialog
						}).then(function(url) {
							layout.currentControl = undefined;
							editor.linkDialogCallback && editor.linkDialogCallback(url || null);
						}, function() {
							layout.currentControl = undefined;
							editor.linkDialogCallback && editor.linkDialogCallback(null);
						});
					}
					else if(currentControl === 'imageDialog') {
						$mdDialog.show({
							templateUrl: 'app/extensions/urlDialog/imageDialog.html',
							onComplete: onImageDialog
						}).then(function(url) {
							layout.currentControl = undefined;
							editor.imageDialogCallback && editor.imageDialogCallback(url || null);
						}, function() {
							layout.currentControl = undefined;
							editor.imageDialogCallback && editor.imageDialogCallback(null);
						});
					}
				});
			}
		};
	});
