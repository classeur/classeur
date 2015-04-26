angular.module('classeur.opt.postToBlog', [])
	.directive('clPostToBlog', function($mdDialog, clEditorLayoutSvc, clBlogSvc, clSocketSvc) {
		return {
			restrict: 'E',
			link: function(scope) {

				function close() {
					clEditorLayoutSvc.currentControl = undefined;
				}

				function open() {
					return editPost();
				}

				function editPost(post) {
					return $mdDialog.show({
						templateUrl: 'opt/postToBlog/editBlogPostDialog.html',
						controller: function(scope) {
							scope.post = post;
							scope.form = angular.extend({}, post);
						},
						onComplete: function(scope) {
							scope.ok = function() {
								var newPost = clBlogSvc.createPost(scope.form);
								if (newPost) {
									// if (post) {
									// 	newBlogPost.id = post.id;
									// 	clSocketSvc.sendMsg({
									// 		type: 'updateBlogPost',
									// 		blogPost: newBlogPost
									// 	});
									// } else {
									// 	clSocketSvc.sendMsg({
									// 		type: 'createBlogPost',
									// 		blogPost: newBlogPost
									// 	});
									// }
									$mdDialog.hide();
								}
							};
							scope.cancel = function() {
								$mdDialog.cancel();
							};
						}
					}).then(function() {
						close();
					}, close);
				}

				scope.$watch('editorLayoutSvc.currentControl === "postToBlog"', function(value) {
					value && open();
				});
			}
		};
	});
