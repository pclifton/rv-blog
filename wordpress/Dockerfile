FROM wordpress:latest

# wget for installing plugins
RUN apt-get update && apt-get install wget unzip

WORKDIR /var/www/html/wp-content/plugins

# S3 uploads plugin
RUN wget https://github.com/humanmade/S3-Uploads/releases/download/3.0.3/manual-install.zip
RUN mkdir s3-uploads
WORKDIR /var/www/html/wp-content/plugins/s3-uploads
RUN unzip ../manual-install.zip && rm -rf ../manual-install.zip

# Other plugins and themes from old blog
# These are just here for the transition period and will go away eventually
ADD legacy-blog/plugins.tgz /var/www/html/wp-content/plugins
ADD legacy-blog/themes.tgz /var/www/html/wp-content/themes

WORKDIR /var/www/html