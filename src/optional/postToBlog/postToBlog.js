angular.module('classeur.optional.postToBlog', [])
	.directive('clPostToBlog',
		function(clDialog, clEditorLayoutSvc, clEditorSvc, clBlogSvc, clSocketSvc, clToast) {
			clSocketSvc.addMsgHandler('createdBlogPost', function(msg) {
				if(msg.error) {
					return clToast(msg.error);
				}
			});

			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {

				function close() {
					clEditorLayoutSvc.currentControl = undefined;
				}

				function open() {
					return newPost();
				}

				function newPost() {
					return clDialog.show({
						templateUrl: 'optional/postToBlog/editBlogPostDialog.html',
						controller: ['$scope', function(scope) {
							scope.form = {};
						}],
						onComplete: function(scope) {
							scope.ok = function() {
								var blogPost = clBlogSvc.createPost(scope.form);
								if (blogPost) {
									clSocketSvc.sendMsg({
										type: 'createBlogPost',
										blogPost: blogPost,
										content: clEditorSvc.applyTemplate(blogPost.template)
									});
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
