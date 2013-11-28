module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        jshint: {
            options: {
                shadow: true
            },
            files: [
                'app/client/srcs/*.js',
                'app/server/*.js'
                ]
        },

        clean: [ 'app/public/*' ],

        copy: {
            dev: {
                expand: true,
                cwd: 'app/client/',
                src: '**',
                dest: 'app/public/',
                filter: 'isFile'
            },
            prod: {
                files: [
                    { expand: true, cwd: 'app/client/', src: ['*'], dest: 'app/public/', filter: 'isFile' },
                    { expand: true, cwd: 'app/client/help/', src: ['**'], dest: 'app/public/help/', filter: 'isFile' },
                    { expand: true, cwd: 'app/client/themes/', src: ['**'], dest: 'app/public/themes/', filter: 'isFile' }
                ]
            }
        },

        concat: {
            options: { separator: ';' },
            js: {
                src:  [
                    'app/client/srcs/i18n.js',
                    'app/client/srcs/redcat-msgbox.js',
                    'app/client/srcs/core.js',
                    'app/client/srcs/views.common.js',
                    'app/client/srcs/views.main.js',
                    'app/client/srcs/views.welcome.js',
                    'app/client/srcs/views.game.js',
                    'app/client/srcs/controller.js'
                ],
                dest: 'app/public/srcs/generals.js'
            }
        },

        cssmin: {
            prod: {
                expand: true,
                cwd:    'app/public/themes/default/',
                src:  '*.css',
                dest: 'app/public/themes/default/'
            }
        },

        uglify: {
            js: {
                src:  'app/public/srcs/generals.js',
                dest: 'app/public/srcs/generals.js'
            }
        },

        scriptlinker: {
            dev: {
                options: {
                    appRoot: 'app/public'
                },
                files: {
                    'app/public/index.html': [
                        'app/public/srcs/i18n.js',
                        'app/public/srcs/redcat-msgbox.js',
                        'app/public/srcs/core.js',
                        'app/public/srcs/views.common.js',
                        'app/public/srcs/views.main.js',
                        'app/public/srcs/views.welcome.js',
                        'app/public/srcs/views.game.js',
                        'app/public/srcs/controller.js'
                    ]
                }
            },
            prod: {
                options: {
                    appRoot: 'app/public'
                },
                files: { 'app/public/index.html': 'app/public/srcs/generals.js' }
            }
        },

        watch: {
            dev: {
                files: [ 'app/client/*.html', 'app/client/srcs/*.js' ],
                tasks: [ 'clean', 'copy:dev', 'scriptlinker:dev' ],
                options: {
                    spawn: false
                }
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-scriptlinker');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('dev', [ 'jshint', 'clean', 'copy:dev', 'scriptlinker:dev' ] );
    grunt.registerTask('prod', [ 'clean', 'copy:prod', 'concat', 'cssmin:prod', 'uglify', 'scriptlinker:prod' ] );
};
