const gulp = require('gulp');
const browserSync = require('browser-sync').create();

gulp.task('sync', function() {
  let files = [
    '*.html',
    'css/*.css',
    'src/*.js'
  ];

  browserSync.init({
    server: {
      files: files,
      baseDir: './',
    },
    port: 3000,
    browser:"vivaldi"
  });

  // watch for any change in these files then reload
  gulp.watch('*.html').on('change',browserSync.reload);
  gulp.watch('css/*.css').on('change',browserSync.reload);
  gulp.watch('src/*.js').on('change',browserSync.reload);
});

