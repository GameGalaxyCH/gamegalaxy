DEV:
Update Migration File, IMPORTANT FIRST STEP!
npx prisma migrate reset --force
npx prisma migrate dev --name ADD CHANGES HERE

PROD:
Stop the container:
docker rm -f gamegalaxy-db

Delete the Volume:
docker volume rm gamegalaxy_db_data