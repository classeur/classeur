angular.module('classeur.optional.postToBlog', [])
	.directive('clPostToBlog',
		function(clDialog, clEditorLayoutSvc, clBlogSvc, clSocketSvc) {
			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {

				function close() {
					clEditorLayoutSvc.currentControl = undefined;
				}

				function open() {
					return editPost();
				}

				function editPost(post) {
					return clDialog.show({
						templateUrl: 'optional/postToBlog/editBlogPostDialog.html',
						controller: ['$scope', function(scope) {
							scope.post = post;
							scope.form = angular.extend({}, post);
						}],
						onComplete: function(scope) {
							scope.ok = function() {
								var newPost = clBlogSvc.createPost(scope.form);
								if (newPost) {
									if (post) {
										newPost.id = post.id;
										clSocketSvc.sendMsg({
											type: 'updateBlogPost',
											blogPost: newPost
										});
									} else {
										clSocketSvc.sendMsg({
											type: 'createBlogPost',
											blogPost: newPost
										});
									}
									clDialog.hide();
								}
							};
							scope.cancel = function() {
								clDialog.cancel();
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
		});
