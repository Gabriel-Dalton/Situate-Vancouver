from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_userprofile_email_verification_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='home_label',
            field=models.CharField(
                blank=True,
                help_text='Human-readable home address',
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='home_lat',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='home_lng',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
