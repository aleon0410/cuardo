JAVASCRIPT = \
js/cuardo.js \
js/proj4-srs.js \
js/TileLoader.js \
js/PlaneGeometry.js \
js/shaders/FXAAShader.js \
js/shaders/BokehShader.js \
js/shaders/CopyShader.js \
js/shaders/SSAOShader.js \
js/WorkerPool.js \
js/GISControls.js \
js/postprocessing/BokehPass.js \
js/postprocessing/EffectComposer.js \
js/postprocessing/ShaderPass.js \
js/postprocessing/MaskPass.js \
js/postprocessing/RenderPass.js \
js/WfsTinLayer.js \
js/Terrain.js \
js/QuadTree.js \
js/LayerSet.js \
js/RasterLayer.js \
js/Symbology.js \
js/Tiler.js \
js/QuadNode.js \
js/WfsLayer.js \
js/Tile.js 


all:
	mkdir -p build
	cat ${JAVASCRIPT} > build/cuardo.js
	for f in ${JAVASCRIPT}; do echo "<script src=\"$$f\"></script>" ; done
