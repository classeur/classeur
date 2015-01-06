angular.module('classeur.extensions.imageDialog', [])
	.directive('clImageDialog', function($mdDialog, $mdToast, $http, layout, editor) {
		var maxSize = 10000000;

		function onShowDialog(scope, element) {

			function handleImageUpload(evt) {

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
					if(len === maxSize) {
						return $mdToast.show(
							$mdToast.simple()
								.content('Image is too big.')
								.position('bottom right')
								.hideDelay(6000)
						);
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

					$http(req)
						.success(function(result) {
							$mdDialog.hide(result.data.link);
						})
						.error(function(err) {
							$mdToast.show(
								$mdToast.simple()
									.content(err.data.error)
									.position('bottom right')
									.hideDelay(6000)
							);
						});
				};
				var blob = file.slice(0, maxSize);
				reader.readAsArrayBuffer(blob);
			}

			function handleDragOver(evt) {
				evt.stopPropagation();
				evt.preventDefault();
				evt.dataTransfer.dropEffect = 'copy';
			}

			var dropZoneElt = element[0].querySelector('.drop-zone');
			dropZoneElt.addEventListener('dragover', handleDragOver, false);
			dropZoneElt.addEventListener('drop', handleImageUpload, false);

			var inputElt = element[0].querySelector('input');
			scope.focus = function() {
				setTimeout(function() {
					inputElt.focus();
				}, 100);
			};
			scope.focus();
		}

		return {
			restrict: 'E',
			link: function(scope) {
				scope.$watch('layout.currentControl', function(currentControl) {
					if(currentControl === 'imageDialog') {
						$mdDialog.show({
							templateUrl: 'app/extensions/imageDialog/imageDialog.html',
							controller: 'ImageDialogController',
							onComplete: onShowDialog
						}).then(function(url) {
							layout.currentControl = undefined;
							editor.imageDialogCallback && editor.imageDialogCallback(url || null);
						}, function() {
							layout.currentControl = undefined;
							editor.imageDialogCallback && editor.imageDialogCallback(null);
						});
					}
					else {
						$mdDialog.hide();
					}
				});
			}
		};
	})
	.controller('ImageDialogController', function(scope, $mdDialog) {
		scope.ok = function() {
			if(!scope.url) {
				return scope.focus();
			}
			$mdDialog.hide(scope.url);
		};
		scope.cancel = function() {
			$mdDialog.cancel();
		};
	});
