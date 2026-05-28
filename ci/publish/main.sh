git checkout gh-pages
git pull origin gh-pages

CNAME=$(cat CNAME)

git checkout main
git pull origin main
git checkout --orphan gh-pages

cd portable
npm install
npm run build

cd ..

mv .git git
rm -rf ./.*
mv git .git

mv portable/dist .dist
rm -rf ./*

mv .dist/* ./
rm -rf .dist

echo $CNAME > CNAME
cp index.html 404.html

git config user.name "Attachment Aditya"
git config user.email "attachment.aditya@gmail.com"

git add .
git commit -m "Deploy using GitHub Pages"
git push origin gh-pages --force

