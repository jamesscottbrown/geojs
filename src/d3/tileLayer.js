geo.d3.tileLayer = function () {
  'use strict';
  var m_this = this,
      s_update = this._update,
      s_init = this._init;

  this._drawTile = function (tile) {
    var bounds = m_this._tileBounds(tile),
        parentNode = m_this._getSubLayer(tile.index.level),
        offsetx = parseInt(parentNode.attr('offsetx') || 0),
        offsety = parseInt(parentNode.attr('offsety') || 0);
    tile.feature = m_this.createFeature(
      'plane', {drawOnAsyncResourceLoad: true})
      .origin([bounds.left - offsetx, bounds.top - offsety])
      .upperLeft([bounds.left - offsetx, bounds.top - offsety])
      .lowerRight([bounds.right - offsetx, bounds.bottom - offsety])
      .style({
        image: tile._url,
        opacity: 1,
        reference: tile.toString(),
        parentId: parentNode.attr('data-tile-layer-id')
      });
    tile.feature._update();
    m_this.draw();
  };

  /**
   * Return the DOM element containing a level specific
   * layer.  This will create the element if it doesn't
   * already exist.
   * @param {number} level The zoom level of the layer to fetch
   * @return {DOM}
   */
  this._getSubLayer = function (level) {
    var node = m_this.canvas().select(
        'g[data-tile-layer="' + level.toFixed() + '"]');
    if (node.empty()) {
      node = m_this.canvas().append('g');
      var id = geo.d3.uniqueID();
      node.classed('group-' + id, true);
      node.classed('geo-tile-layer', true);
      node.attr('data-tile-layer', level.toFixed());
      node.attr('data-tile-layer-id', id);
    }
    return node;
  };

  /**
   * Set sublayer transforms to align them with the given zoom level.
   * @param {number} level The target zoom level
   * @param {object} view The view bounds.  The top and left are used to
   *                      adjust the offset of tile layers.
   * @return {object} the x and y offsets for the current level.
   */
  this._updateSubLayers = function (level, view) {
    var canvas = m_this.canvas(),
        lastlevel = parseInt(canvas.attr('lastlevel')),
        lastx = parseInt(canvas.attr('lastoffsetx') || 0),
        lasty = parseInt(canvas.attr('lastoffsety') || 0);
    if (lastlevel === level && Math.abs(lastx - view.left) < 65536 &&
        Math.abs(lasty - view.top) < 65536) {
      return {x: lastx, y: lasty};
    }
    var x = parseInt(view.left), y = parseInt(view.top);
    var tileCache = m_this.cache._cache;
    $.each(canvas.selectAll('.geo-tile-layer')[0], function (idx, el) {
      var layer = parseInt($(el).attr('data-tile-layer')),
          scale = Math.pow(2, level - layer);
      el = m_this._getSubLayer(layer);
      el.attr('transform', 'matrix(' + [scale, 0, 0, scale, 0, 0].join() + ')');
      /* x and y are the upper left of our view.  This is the zero-point for
       * offsets at the current level.  Other tile layers' offsets are scaled
       * by appropriate factors of 2.  We need to shift the tiles of each
       * layer by the appropriate amount (computed as dx and dy). */
      var layerx = parseInt(x / Math.pow(2, level - layer)),
          layery = parseInt(y / Math.pow(2, level - layer)),
          dx = layerx - parseInt(el.attr('offsetx') || 0),
          dy = layery - parseInt(el.attr('offsety') || 0);
      el.attr({offsetx: layerx, offsety: layery});
      /* We have to update the values stored in the tile features, too,
       * otherwise when d3 regenerates these features, the offsets will be
       * wrong. */
      $.each(tileCache, function (idx, tile) {
        if (tile._index.level === layer && tile.feature) {
          var f = tile.feature,
              o = f.origin(), ul = f.upperLeft(), lr = f.lowerRight();
          f.origin([o[0] - dx, o[1] - dy, o[2]]);
          f.upperLeft([ul[0] - dx, ul[1] - dy, ul[2]]);
          f.lowerRight([lr[0] - dx, lr[1] - dy, lr[2]]);
          f._update();
        }
      });
    });
    canvas.attr({lastoffsetx: x, lastoffsety: y, lastlevel: level});
    return {x: x, y: y};
  };

  /* Initialize the tile layer.  This creates a series of sublayers so that
   * the different layers will stack in the proper order.
   */
  this._init = function () {
    var sublayer;

    s_init.apply(m_this, arguments);
    for (sublayer = 0; sublayer <= m_this._options.maxLevel; sublayer += 1) {
      m_this._getSubLayer(sublayer);
    }
  };

  /* When update is called, apply the transform to our renderer. */
  this._update = function () {
    s_update.apply(m_this, arguments);
    m_this.renderer()._setTransform();
  };

  /* Remove both the tile feature and an internal image element. */
  this._remove = function (tile) {
    if (tile.feature) {
      m_this.deleteFeature(tile.feature);
      tile.feature = null;
    }
    if (tile.image) {
      $(tile.image).remove();
    }
  };
};

geo.registerLayerAdjustment('d3', 'tile', geo.d3.tileLayer);