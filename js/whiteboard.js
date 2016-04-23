/**
 * Created by David on 4/7/2016.
 */


(function($, undefined) {

    "use strict";

    Rdbhost.connect(1730);
    var preauthModel = window.Rdbhost.preauth().listen('stroke-db');

    function get_drawing_strokes(drawid) {

        var preauth = preauthModel.clone(),
            p = preauth.query('SELECT data, owner FROM strokes WHERE drawing_id = %s ORDER BY idx LIMIT 1000;')
                .params([drawid])
                .get_data();

        return p.then(function(d) {
                var recs = d.result_sets[0].records.rows;
                $.each(recs, function(_i, rec) {
                    rec.data = JSON.parse(rec.data);
                });
                return recs;
            })
            .catch(function(e) {
                console.log(e);
                throw e;
            })
    }

    function create_new_drawing(evt) {

        function new_dwg() {

            bootbox.prompt({'title': 'Enter name of new drawing',
                callback: function(name) {

                    var preauth = preauthModel.clone(),
                        p = preauth.query('INSERT INTO drawings (owner, name)  ' +
                                '  SELECT idx, %(name)s FROM auth.fedauth_accounts WHERE idx = %(idx)s AND key = %(key)s;\n' +
                                "SELECT CURRVAL('drawings_idx_seq') AS drawing_id;")
                            .params({name: name, idx: userIdx, key: userKey})
                            .get_data();

                    return p.then(function (d) {
                            var drawing_id = d.result_sets[1].records.rows[0].drawing_id;
                            drawingIdx = drawing_id;
                            var sktch = $('#simple_sketch');
                            sktch.trigger('clear');
                        })
                        .catch(function (e) {
                            if (e.message.substr(0, 5) === '23505') {

                                new_dwg();
                            }
                            else {

                                console.log(e);
                                throw e;
                            }
                        })
                }
            });
        }

        new_dwg();
    }

    function populate_drawing_list() {

        var preauth = preauthModel.clone(),
            p = preauth.query('SELECT idx, owner, name FROM drawings;')
                .get_data();

        return p.then(function (d) {
                var rows = d.result_sets[0].records.rows;
                var $menu = $('.dropdown-menu');
                $menu.empty();
                $.each(rows, function(i, row) {
                    var r = '<li><a href="#" data-id="'+row.idx+'">'+row.name+'</a></li>';
                    $menu.append(r);
                });
            })
            .catch(function (e) {
                console.log(e);
                throw e;
            })
    }

    function load_drawing(drawing_id) {

        var strokesPromise = get_drawing_strokes(drawing_id);
        strokesPromise.then(function (recs) {

                var sketch = $('#simple_sketch'),
                    sketchObj = sketch.first().data('sketch');

                sketch.trigger('clear');
                var strokes = $.map(recs, function (r) { return r.data });
                sketch.trigger('load', [strokes]);
            })
            .catch(function (e) {
                console.log(e);
                throw e;
            });

    }


    function whiteboard(eventEmitter) {

        eventEmitter.on('stroke-end', function (e, action) {

            window.console.log('stroke received ' + action.events.length);
            action.owner = userIdx;
            var actionJson = JSON.stringify(action);

            var preauth = preauthModel.clone(),
                p = preauth.query('INSERT INTO strokes (drawing_id,  owner,     data)'+
                                  '               VALUES(%(drawing)s, %(owner)s, %(action)s);\n' +
                                  'NOTIFY "stroke-db", %(action)s;')
                    .params({'drawing': drawingIdx, 'owner': userIdx, 'action': actionJson})
                    .get_data();

            p.then(function (d) {

                  console.log(d.status);
                })
                .catch(function (e) {
                  console.log(e);
                  throw e;
                });
        });

        Rdbhost.on('notify-received:stroke-db', function (channel, payload) {

            console.log('stroke-db NOTIFY '+payload.length);
            var data = JSON.parse(payload);

            var sketch = $('#simple_sketch'),
                sketchObj = sketch.first().data('sketch');

            if (data.owner !== userIdx) {

                sketch.trigger('load', [[data]]);
            }
        });
    }

    window.whiteboard = {
        'create': whiteboard,
        'new':    create_new_drawing,
        'populate_list': populate_drawing_list,
        'load': load_drawing
    };

})(jQuery);