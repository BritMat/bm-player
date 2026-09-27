# The fox

`fox3d.py` is the design source for the 3D fox on the welcome screen. It
holds every point of the head by hand, with its depth, and the triangles
between them. The front is the flat design (`flat-fox-design.py`, which is
also what `src/js/geofox.js` draws in Lite mode); the skull, throat and ear
thickness are added here.

Preview it from several angles (needs Pillow):

    python3 fox3d.py preview.png

Regenerate the mesh the app draws after changing anything:

    python3 -c "exec(open('fox3d.py').read().replace(\"if __name__ == '__main__':\", 'if False:')); print(export_js('../../src/js/fox3d-mesh.js'))"

Always look at the preview from the side as well as the front. The fox
this replaced was never looked at from any angle: its head floated above
its body and its facets had cracked apart.
