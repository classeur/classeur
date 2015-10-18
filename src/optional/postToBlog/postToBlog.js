angular.module('classeur.optional.postToBlog', [])
	.directive('clUpdateBlogPostsButton',
		function(clPostToBlogSvc) {
			return {
				restrict: 'E',
				templateUrl: 'optional/postToBlog/updateBlogPostsButton.html',
				link: link
			};

			function link(scope, element) {
				scope.postToBlogSvc = clPostToBlogSvc;
				var isHover, panelElt = element[0].querySelector('.panel'),
					duration;

				function toggle() {
					panelElt.clanim
						.duration(duration)
						.translateX(isHover && !clPostToBlogSvc.isUpdating ? 0 : -5)
						.start(true);
					duration = 200;
				}

				panelElt.addEventListener('mouseenter', function() {
					isHover = true;
					toggle();
				});
				panelElt.addEventListener('mouseleave', function() {
					isHover = false;
					toggle();
				});
				scope.$watch('postToBlogSvc.isUpdating', toggle);
			}
		})
	.directive('clPostToBlog',
		function(clDialog, clEditorLayoutSvc, clEditorSvc, clBlogSvc, clSocketSvc, clToast, clPostToBlogSvc, clTemplateManagerDialog, clSettingSvc) {
			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {

				function close() {
					clEditorLayoutSvc.currentControl = undefined;
				}

				function open() {
					if (!clSocketSvc.isReady) {
						return clDialog.show(
							clDialog.alert()
							.title('You\'re offline')
							.content('You can\'t manage blog posts while offline.')
							.ariaLabel('You\'re offline')
							.ok('Ok')
						).then(close, close);
					}
					clPostToBlogSvc.blogPosts.length ? showPosts() : newPost();
				}

				function showPosts() {
					return clDialog.show({
						templateUrl: 'optional/postToBlog/blogPostsDialog.html',
						controller: ['$scope', function(scope) {
							scope.postToBlogSvc = clPostToBlogSvc;
						}],
						onComplete: function(scope) {
							scope.newPost = newPost;
							scope.updateBlogPost = clPostToBlogSvc.updateBlogPost;
							scope.deleteBlogPost = function(blogPost) {
								clPostToBlogSvc.deleteBlogPost(blogPost);
								clSocketSvc.sendMsg({
									type: 'deleteBlogPost',
									id: blogPost.id
								});
							};
							scope.close = function() {
								clDialog.hide();
							};
						}
					}).then(close, close);
				}

				function newPost() {
					var fileDao = scope.currentFileDao;
					var properties = fileDao.contentDao.properties;
					var title = properties.title || fileDao.name;
					return clDialog.show({
						templateUrl: 'optional/postToBlog/newBlogPostDialog.html',
						controller: ['$scope', function(scope) {
							scope.form = {};
						}],
						onComplete: function(scope) {
							scope.manageTemplates = function() {
								clTemplateManagerDialog(clSettingSvc.values.exportTemplates)
									.then(function(templates) {
										clSettingSvc.values.exportTemplates = templates;
										newPost();
									}, newPost);
							};
							scope.ok = function() {
								var blogPost = clBlogSvc.createPost(scope.form);
								if (!blogPost) {
									return;
								}
								if (scope.form.blog.status !== 'linked') {
									return clToast('Blog is not linked.');
								}
								clDialog.hide();
								clEditorSvc.applyTemplate(blogPost.template)
									.then(function(content) {
										clSocketSvc.sendMsg({
											type: 'createBlogPost',
											blogPost: blogPost,
											content: content,
											title: title,
											properties: properties
										});
									});
							};
							scope.cancel = function() {
								clDialog.cancel();
							};
						}
					}).then(close, close);
				}

				scope.$watch('editorLayoutSvc.currentControl === "postToBlog"', function(value) {
					value && open();
				});

				function createdBlogPostHandler(msg) {
					if (msg.error) {
						return clToast(msg.error);
					}
					clToast('Blog post successfully created.');
					msg.fileId === scope.currentFileDao.id && clPostToBlogSvc.addBlogPost(msg.blogPost);
				}

				function blogsHandler(msg) {
					clPostToBlogSvc.setBlogs(msg.blogs);
					scope.$evalAsync();
				}

				function blogPostsHandler(msg) {
					msg.fileId === scope.currentFileDao.id && clPostToBlogSvc.setBlogPosts(msg.blogPosts);
					scope.$evalAsync();
				}

				clSocketSvc.addMsgHandler('createdBlogPost', createdBlogPostHandler);
				clSocketSvc.addMsgHandler('blogs', blogsHandler);
				clSocketSvc.addMsgHandler('blogPosts', blogPostsHandler);
				scope.$on('$destroy', function() {
					clSocketSvc.removeMsgHandler('createdBlogPost', createdBlogPostHandler);
					clSocketSvc.removeMsgHandler('blogs', blogsHandler);
					clSocketSvc.removeMsgHandler('blogPosts', blogPostsHandler);
				});

				scope.$watch('contentSyncSvc.watchCtx.text !== undefined', function(isWatching) {
					if (!isWatching) {
						return;
					}
					clSocketSvc.sendMsg({
						type: 'getBlogs'
					});
					clSocketSvc.sendMsg({
						type: 'getBlogPosts'
					});
				});
				clPostToBlogSvc.setBlogPosts();
			}
		})
	.factory('clPostToBlogSvc',
		function($rootScope, $q, $timeout, clBlogSvc, clToast, clSocketSvc, clEditorSvc) {
			var blogMap = Object.create(null),
				posts = [],
				clPostToBlogSvc = {
					blogPosts: []
				};

			clSocketSvc.addMsgHandler('sentBlogPost', function(msg) {
				clPostToBlogSvc.blogPosts.cl_some(function(blogPost) {
					if (blogPost.id === msg.id) {
						blogPost.updateCb && blogPost.updateCb(msg.error);
						blogPost.updateCb = undefined;
						checkIsUpdating();
						return true;
					}
				});
			});

			function checkIsUpdating() {
				clPostToBlogSvc.isUpdating = clPostToBlogSvc.blogPosts.cl_some(function(blogPost) {
					return blogPost.updateCb;
				});
			}

			function refreshBlogPosts() {
				clPostToBlogSvc.blogPosts = posts.cl_filter(function(blogPost) {
					return (blogPost.blog = blogMap[blogPost.blogId]);
				});
				checkIsUpdating();
			}

			clPostToBlogSvc.setBlogs = function(blogs) {
				blogMap = blogs.cl_reduce(function(blogMap, blog) {
					blog.platform = clBlogSvc.platformMap[blog.platformId];
					return (blogMap[blog.id] = blog), blogMap;
				}, {});
				refreshBlogPosts();
			};
			clPostToBlogSvc.setBlogPosts = function(blogPosts) {
				posts = blogPosts || [];
				refreshBlogPosts();
			};
			clPostToBlogSvc.addBlogPost = function(blogPost) {
				posts.push(blogPost);
				refreshBlogPosts();
			};
			clPostToBlogSvc.deleteBlogPost = function(blogPost) {
				posts = posts.cl_filter(function(post) {
					return post !== blogPost;
				});
				refreshBlogPosts();
			};

			function updateBlogPost(blogPost) {
				var fileDao = $rootScope.currentFileDao;
				var properties = fileDao.contentDao.properties;
				var title = properties.title || fileDao.name;
				var blogPostLight = ({}).cl_extend(blogPost);
				blogPostLight.template = undefined;
				blogPostLight.blog = undefined;
				clEditorSvc.applyTemplate(blogPost.template)
					.then(function(content) {
						clSocketSvc.sendMsg({
							type: 'sendBlogPost',
							blogPost: blogPostLight,
							content: content,
							title: title,
							properties: properties
						});
					});
				return $q(function(resolve) {
					blogPost.updateCb = resolve;
				});
			}

			clPostToBlogSvc.updateBlogPost = function(blogPost) {
				if (!blogPost.updateCb) {
					clToast('Updating blog post...');
					updateBlogPost(blogPost)
						.then(function(err) {
							$timeout(function() {
								clToast(err || 'Blog post has been updated.');
							}, 800); // Timeout due to previous clToast overlap
						});
					checkIsUpdating();
				}
			};
			clPostToBlogSvc.updateAll = function() {
				!clPostToBlogSvc.isUpdating && clToast('Updating blog posts...');
				$q.all(clPostToBlogSvc.blogPosts.cl_map(function(blogPost) {
					return !blogPost.updateCb && updateBlogPost(blogPost);
				})).then(function(results) {
					var msg;
					if (!results.cl_some(function(err) {
							if (err) {
								msg = err;
								return true;
							}
						})) {
						msg = results.length + (results.length > 1 ? ' blog posts have been updated.' : ' blog post has been updated.');
					}
					$timeout(function() {
						clToast(msg);
					}, 800); // Timeout due to previous clToast overlap
				});
				checkIsUpdating();
			};
			return clPostToBlogSvc;
		});
