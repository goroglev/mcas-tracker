files=(app.js public/index.html public/script.js public/style.css)
out="combined.txt"
for f in "${files[@]}"; 
do   
	echo "$f" >> "$out"
	echo "------------------" >> "$out"   
	cat "$f" >> "$out"   
	echo "" >> "$out"
done
