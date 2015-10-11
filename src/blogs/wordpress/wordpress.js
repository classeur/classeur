angular.module('classeur.blogs.wordpress', [])
	.directive('clWordpressBlogForm',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'blogs/wordpress/wordpressBlogForm.html'
			};
		})
	.directive('clWordpressBlogPostEntry',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'blogs/wordpress/wordpressBlogPostEntry.html'
			};
		})
	.directive('clWordpressBlogPostForm',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'blogs/wordpress/wordpressBlogPostForm.html'
			};
		})
	.factory('clWordpressBlogPlatform',
		function(clBlogPlatform, clConfig, clUrlSanitizer) {
			var clWordpressBlogPlatform = clBlogPlatform({
				id: 'wordpress',
				name: 'WordPress',
				authorizeUrl: 'https://public-api.wordpress.com/oauth2/authorize'
			});

			clWordpressBlogPlatform.createBlogFromSubForm = function(subForm) {
				var blogUrl = clUrlSanitizer(subForm.blogUrl);
				if (!blogUrl) {
					throw 'Blog URL is invalid.';
				}
				if (blogUrl > 256) {
					throw 'Repository URL is too long.';
				}
				return {
					blogUrl: blogUrl
				};
			};

			clWordpressBlogPlatform.createPostFromSubForm = function(subForm) {
				if (subForm.postId && subForm.postId.length > 128) {
					throw 'Post ID is too long.';
				}
				return {
					postId: subForm.postId
				};
			};

			clWordpressBlogPlatform.getAuthorizeParams = function(blog) {
				return {
					client_id: clConfig.wordpressClientId,
					response_type: 'code',
					redirect_uri: clConfig.appUri + '/oauth/wordpress/callback',
					blog: blog.blogUrl
				};
			};

			clWordpressBlogPlatform.getBlogPostLocation = function(blogPost) {
				return [
					'https://wordpress.com/post',
					blogPost.blog.blogId,
					blogPost.postId
				].join('/');
			};

			return clWordpressBlogPlatform;
		});
