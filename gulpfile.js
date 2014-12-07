var gulp = require('gulp');
var watch = require('gulp-watch');
var minifycss = require('gulp-minify-css');
var sass = require('gulp-sass');
var inject = require('gulp-inject');

gulp.task('express', function() {
	process.env.NO_CLUSTER = true;
	require('./index');
});

gulp.task('sass', function() {
	return gulp.src(__dirname + '/public/styles/main.scss')
		.pipe(sass())
		//.pipe(minifycss())
		.pipe(gulp.dest(__dirname + '/public/styles'));
});


var vendorJs = [
	'bower_components/angular/angular.js',
	'bower_components/angular-aria/angular-aria.js',
	'bower_components/angular-animate/angular-animate.js',
	'bower_components/hammerjs/hammer.js',
	'bower_components/angular-material/angular-material.js',
	'bower_components/famous/dist/famous-global.js',
	'bower_components/famous-angular/dist/famous-angular.js',
	'bower_components/google-diff-match-patch-js/diff_match_patch.js',
	'bower_components/rangy-official/rangy-core.js',
	'bower_components/ced/scripts/cedCore.js',
	'bower_components/ced/scripts/cedHighlighter.js',
	'bower_components/ced/scripts/cedPrism.js',
	'bower_components/ced/scripts/cedSelectionMgr.js',
	'bower_components/ced/scripts/cedUndoMgr.js',
	'bower_components/ced/scripts/cedUtils.js',
	'bower_components/ced/scripts/cedWatcher.js',
];

gulp.task('html', function() {
	return gulp.src('./tmpl/index.html')
		.pipe(inject(
			gulp.src(vendorJs, {read: false, cwd: './public'}),
			{starttag: '<!-- inject:vendor:{{ext}} -->'}))
		.pipe(inject(
			gulp.src([
				'./app/**/*.js'
			], {read: false, cwd: './public'}),
			{starttag: '<!-- inject:app:{{ext}} -->'}))
		.pipe(gulp.dest('./public/'));
});

gulp.task('watch', function() {
	gulp.watch(__dirname + '/public/styles/*', ['sass']);
	gulp.watch(__dirname + '/public/app/**/*.js', ['html']);
});

gulp.task('default', [
	'sass',
	'html',
	'watch',
	'express'
]);
