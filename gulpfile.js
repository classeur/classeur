var gulp = require('gulp');
var watch = require('gulp-watch');
var minifycss = require('gulp-minify-css');
var sass = require('gulp-sass');

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


gulp.task('watch', function () {
	gulp.watch(__dirname + '/public/styles/*', ['sass']);
});

gulp.task('default', ['sass', 'watch', 'express']);
