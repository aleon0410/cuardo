#!/usr/bin/env bash
if [ -z "$1" -o -z "$2" -o -z "$3" ]; then
    echo "Arguments: orig_dir new_dir division"
    exit
fi
in_dir=$1
out_dir=$2
mkdir -p $out_dir
div=$3
rs=$(( 100 / $div ))
for f in $in_dir/*.jpg; do
    ff=$(basename $f);
    of=$out_dir/$ff
    echo $ff
    convert $in_dir/$ff -resize $rs% $of
done

