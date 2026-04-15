from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_border_wait_task'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='email_verified',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='email_verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
